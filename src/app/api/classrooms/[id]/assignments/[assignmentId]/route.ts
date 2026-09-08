import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { getClassroomRole } from "../_auth";

export const dynamic = "force-dynamic";
const BUCKET = "assignment-files";

async function signed(client: Parameters<typeof getClassroomRole>[0], item: Record<string, unknown>) {
  const paths = Array.isArray(item.media_paths) ? item.media_paths as string[] : [];
  const { data } = paths.length ? await client.storage.from(BUCKET).createSignedUrls(paths, 3600) : { data: [] };
  return { ...item, media_urls: (data ?? []).filter((entry) => entry.signedUrl).map((entry) => ({ path: entry.path, url: entry.signedUrl })) };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const { id, assignmentId } = await params;
  const role = await getClassroomRole(auth.client, id, auth.user.id);
  if (!role) return NextResponse.json({ error: "你不是该班级成员" }, { status: 403 });
  const { data: assignment } = await auth.client.from("classroom_assignments").select("*").eq("id", assignmentId).eq("classroom_id", id).maybeSingle();
  if (!assignment) return NextResponse.json({ error: "作业不存在" }, { status: 404 });

  if (role === "teacher") {
    const [{ data: recipients }, { data: submissions }] = await Promise.all([
      auth.client.from("assignment_recipients").select("assignment_id, user_id, email").eq("assignment_id", assignmentId),
      auth.client.from("assignment_submissions").select("*").eq("assignment_id", assignmentId).order("submitted_at"),
    ]);
    return NextResponse.json({ assignment: await signed(auth.client, assignment), recipients: recipients ?? [], submissions: await Promise.all((submissions ?? []).map((item) => signed(auth.client, item))), my_role: role });
  }

  const { data: recipient } = await auth.client.from("assignment_recipients").select("id").eq("assignment_id", assignmentId).eq("user_id", auth.user.id).maybeSingle();
  if (!recipient) return NextResponse.json({ error: "这份作业未发布给你" }, { status: 403 });
  const { data: submission } = await auth.client.from("assignment_submissions").select("*").eq("assignment_id", assignmentId).eq("user_id", auth.user.id).maybeSingle();
  const studentAssignment = Object.fromEntries(Object.entries(assignment).filter(([key]) => key !== "teacher_answer_paths" && key !== "teacher_answer_text"));
  return NextResponse.json({ assignment: await signed(auth.client, studentAssignment), submission: submission ? await signed(auth.client, submission) : null, my_role: role });
}
