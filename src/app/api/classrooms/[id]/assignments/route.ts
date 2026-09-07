import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { canManageAssignments, getClassroomRole } from "./_auth";
import { notifyAssignmentStudents } from "@/lib/notifications";

export const dynamic = "force-dynamic";
const BUCKET = "assignment-files";
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "audio/mpeg", "audio/wav", "audio/webm", "video/mp4", "video/webm", "application/pdf"]);

function safeName(name: string): string {
  const extension = name.includes(".") ? `.${name.split(".").pop()}` : "";
  return `${crypto.randomUUID()}${extension.toLowerCase().replace(/[^.a-z0-9]/g, "")}`;
}

async function addMediaUrls<T extends { media_paths?: string[] | null }>(
  client: Parameters<typeof getClassroomRole>[0],
  submissions: T[],
) {
  return Promise.all(submissions.map(async (submission) => {
    const paths = submission.media_paths ?? [];
    if (!paths.length) return { ...submission, media_urls: [] };
    const { data } = await client.storage.from(BUCKET).createSignedUrls(paths, 3600);
    return {
      ...submission,
      media_urls: (data ?? []).filter((item) => item.signedUrl).map((item) => ({ path: item.path, url: item.signedUrl })),
    };
  }));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const { id: classroomId } = await params;
  const role = await getClassroomRole(auth.client, classroomId, auth.user.id);
  if (!role) {
    return NextResponse.json({ error: "你不是该班级成员" }, { status: 403 });
  }

  const { data: assignments, error } = await auth.client
    .from("classroom_assignments")
    .select("*")
    .eq("classroom_id", classroomId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!assignments?.length) {
    return NextResponse.json({ assignments: [], my_role: role });
  }

  const assignmentIds = assignments.map((item) => item.id as string);
  if (canManageAssignments(role)) {
    const [{ data: recipients, error: recipientError }, { data: submissions, error: submissionError }] =
      await Promise.all([
        auth.client
          .from("assignment_recipients")
          .select("assignment_id, user_id, email")
          .in("assignment_id", assignmentIds),
        auth.client
          .from("assignment_submissions")
          .select("*")
          .in("assignment_id", assignmentIds)
          .order("submitted_at", { ascending: true }),
      ]);
    if (recipientError || submissionError) {
      return NextResponse.json(
        { error: recipientError?.message || submissionError?.message },
        { status: 500 },
      );
    }
    return NextResponse.json({
      assignments: await addMediaUrls(auth.client, assignments),
      recipients: recipients ?? [],
      submissions: await addMediaUrls(auth.client, submissions ?? []),
      my_role: role,
      server_now: new Date().toISOString(),
    });
  }

  const { data: submissions, error: submissionError } = await auth.client
    .from("assignment_submissions")
    .select("*")
    .in("assignment_id", assignmentIds)
    .eq("user_id", auth.user.id);
  if (submissionError) {
    return NextResponse.json({ error: submissionError.message }, { status: 500 });
  }
  return NextResponse.json({
    assignments: await addMediaUrls(auth.client, assignments),
    submissions: await addMediaUrls(auth.client, submissions ?? []),
    my_role: role,
    server_now: new Date().toISOString(),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const { id: classroomId } = await params;
  const role = await getClassroomRole(auth.client, classroomId, auth.user.id);
  if (!role || !canManageAssignments(role)) {
    return NextResponse.json({ error: "只有教师能发布作业" }, { status: 403 });
  }

  let title = "";
  let content = "";
  let endsAtValue = "";
  let files: File[] = [];
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      title = String(form.get("title") ?? "").trim();
      content = String(form.get("content") ?? "").trim();
      endsAtValue = String(form.get("ends_at") ?? "");
      files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    } else {
      const body = (await request.json()) as { title?: unknown; content?: unknown; ends_at?: unknown };
      title = typeof body.title === "string" ? body.title.trim() : "";
      content = typeof body.content === "string" ? body.content.trim() : "";
      endsAtValue = typeof body.ends_at === "string" ? body.ends_at : "";
    }
  } catch {
    return NextResponse.json({ error: "无法读取发布内容" }, { status: 400 });
  }
  const endsAt = endsAtValue ? new Date(endsAtValue) : null;
  if (!title || !content || !endsAt || Number.isNaN(endsAt.getTime())) {
    return NextResponse.json({ error: "请填写题目、要求和截止时间" }, { status: 400 });
  }
  if (title.length > 300 || content.length > 12_000) {
    return NextResponse.json({ error: "作业题目或要求过长" }, { status: 400 });
  }
  if (files.length > 5) return NextResponse.json({ error: "每次最多上传 5 个附件" }, { status: 400 });
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `附件 ${file.name} 类型不支持或超过 25MB` }, { status: 400 });
    }
  }
  if (endsAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "截止时间必须晚于当前时间" }, { status: 400 });
  }

  const { data: assignment, error: assignmentError } = await auth.client
    .from("classroom_assignments")
    .insert({
      classroom_id: classroomId,
      title,
      content,
      ends_at: endsAt.toISOString(),
      created_by: auth.user.id,
    })
    .select()
    .single();
  if (assignmentError || !assignment) {
    return NextResponse.json({ error: assignmentError?.message || "发布失败" }, { status: 500 });
  }

  const uploadedPaths: string[] = [];
  for (const file of files) {
    const path = `${assignment.id}/${auth.user.id}/${safeName(file.name)}`;
    const { error: uploadError } = await auth.client.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      if (uploadedPaths.length) await auth.client.storage.from(BUCKET).remove(uploadedPaths);
      await auth.client.from("classroom_assignments").delete().eq("id", assignment.id);
      return NextResponse.json({ error: `附件上传失败：${uploadError.message}` }, { status: 500 });
    }
    uploadedPaths.push(path);
  }
  if (uploadedPaths.length) {
    const { error: pathError } = await auth.client.from("classroom_assignments").update({ media_paths: uploadedPaths }).eq("id", assignment.id);
    if (pathError) {
      await auth.client.storage.from(BUCKET).remove(uploadedPaths);
      await auth.client.from("classroom_assignments").delete().eq("id", assignment.id);
      return NextResponse.json({ error: pathError.message }, { status: 500 });
    }
    assignment.media_paths = uploadedPaths;
  }

  const { data: members, error: memberError } = await auth.client
    .from("classroom_members")
    .select("user_id, email")
    .eq("classroom_id", classroomId)
    .eq("status", "approved")
    .neq("role", "teacher");
  if (memberError) {
    if (uploadedPaths.length) await auth.client.storage.from(BUCKET).remove(uploadedPaths);
    await auth.client.from("classroom_assignments").delete().eq("id", assignment.id);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }
  if (members?.length) {
    const { error: recipientError } = await auth.client
      .from("assignment_recipients")
      .insert(
        members.map((member) => ({
          assignment_id: assignment.id,
          user_id: member.user_id,
          email: member.email,
        })),
      );
    if (recipientError) {
      if (uploadedPaths.length) await auth.client.storage.from(BUCKET).remove(uploadedPaths);
      await auth.client.from("classroom_assignments").delete().eq("id", assignment.id);
      return NextResponse.json({ error: recipientError.message }, { status: 500 });
    }
  }
  await notifyAssignmentStudents(auth.client, classroomId, assignment.id, title);
  return NextResponse.json({ assignment }, { status: 201 });
}
