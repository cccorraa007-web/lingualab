import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { getClassroomRole } from "../../_auth";
import { notifyAssignmentTeachers } from "@/lib/notifications";

export const dynamic = "force-dynamic";
const BUCKET = "assignment-files";
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "audio/mpeg", "audio/wav", "audio/webm", "video/mp4", "video/webm", "application/pdf"]);

function safeName(name: string): string {
  const extension = name.includes(".") ? `.${name.split(".").pop()}` : "";
  return `${crypto.randomUUID()}${extension.toLowerCase().replace(/[^.a-z0-9]/g, "")}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const { id: classroomId, assignmentId } = await params;
  if (await getClassroomRole(auth.client, classroomId, auth.user.id) !== "student") {
    return NextResponse.json({ error: "只有班级学生可以提交作业" }, { status: 403 });
  }

  let content = "";
  let files: File[] = [];
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      content = String(form.get("content") ?? "").trim();
      files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    } else {
      const body = (await request.json()) as { content?: unknown };
      content = typeof body.content === "string" ? body.content.trim() : "";
    }
  } catch {
    return NextResponse.json({ error: "无法读取提交内容" }, { status: 400 });
  }
  if (content.length > 20_000) return NextResponse.json({ error: "作业内容不能超过 20000 个字符" }, { status: 400 });
  if (files.length > 5) return NextResponse.json({ error: "每次最多上传 5 个附件" }, { status: 400 });
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `附件 ${file.name} 类型不支持或超过 25MB` }, { status: 400 });
    }
  }

  const { data: assignment } = await auth.client.from("classroom_assignments").select("id, title, ends_at").eq("id", assignmentId).eq("classroom_id", classroomId).maybeSingle();
  if (!assignment) return NextResponse.json({ error: "作业不存在" }, { status: 404 });
  const { data: recipient } = await auth.client.from("assignment_recipients").select("id").eq("assignment_id", assignmentId).eq("user_id", auth.user.id).maybeSingle();
  if (!recipient) return NextResponse.json({ error: "这份作业未发布给你" }, { status: 403 });

  const { data: existing } = await auth.client.from("assignment_submissions").select("id, submitted_at, media_paths").eq("assignment_id", assignmentId).eq("user_id", auth.user.id).maybeSingle();
  const oldPaths = (existing?.media_paths ?? []) as string[];
  if (!content && files.length === 0 && oldPaths.length === 0) return NextResponse.json({ error: "请填写文字或上传附件" }, { status: 400 });

  const uploadedPaths: string[] = [];
  for (const file of files) {
    const path = `${assignmentId}/${auth.user.id}/${safeName(file.name)}`;
    const { error } = await auth.client.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      if (uploadedPaths.length) await auth.client.storage.from(BUCKET).remove(uploadedPaths);
      return NextResponse.json({ error: `附件上传失败：${error.message}` }, { status: 500 });
    }
    uploadedPaths.push(path);
  }

  const mediaPaths = files.length ? uploadedPaths : oldPaths;
  const values = { content: content || null, media_paths: mediaPaths, ...(files.length ? { ocr_text: null } : {}), feedback: null, grade: null, score: null, graded_by: null, graded_at: null };
  const mutation = existing
    ? auth.client.from("assignment_submissions").update(values).eq("id", existing.id).eq("user_id", auth.user.id).select().single()
    : auth.client.from("assignment_submissions").insert({ assignment_id: assignmentId, user_id: auth.user.id, ...values }).select().single();
  const { data: submission, error } = await mutation;
  if (error || !submission) {
    if (uploadedPaths.length) await auth.client.storage.from(BUCKET).remove(uploadedPaths);
    return NextResponse.json({ error: error?.message || "提交失败" }, { status: 500 });
  }
  if (files.length && oldPaths.length) await auth.client.storage.from(BUCKET).remove(oldPaths);
  await notifyAssignmentTeachers(auth.client, classroomId, assignmentId, `学生提交了作业：${assignment.title}`);
  return NextResponse.json({ submission, late: new Date(submission.submitted_at).getTime() > new Date(assignment.ends_at).getTime() });
}
