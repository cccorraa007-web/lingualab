import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { getClassroomRole } from "../../_auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; assignmentId: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const { id: classroomId, assignmentId } = await params;
  const role = await getClassroomRole(auth.client, classroomId, auth.user.id);
  if (!role || role === "teacher") {
    return NextResponse.json({ error: "只有班级学生可以提交作业" }, { status: 403 });
  }

  let body: { content?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "请填写作业内容" }, { status: 400 });
  }
  if (content.length > 20_000) {
    return NextResponse.json({ error: "作业内容不能超过 20000 个字符" }, { status: 400 });
  }

  const { data: assignment } = await auth.client
    .from("classroom_assignments")
    .select("id, ends_at")
    .eq("id", assignmentId)
    .eq("classroom_id", classroomId)
    .maybeSingle();
  if (!assignment) {
    return NextResponse.json({ error: "作业不存在" }, { status: 404 });
  }
  const { data: recipient } = await auth.client
    .from("assignment_recipients")
    .select("id")
    .eq("assignment_id", assignmentId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!recipient) {
    return NextResponse.json({ error: "这份作业未发布给你" }, { status: 403 });
  }

  const { data: existing } = await auth.client
    .from("assignment_submissions")
    .select("id, submitted_at")
    .eq("assignment_id", assignmentId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const now = new Date().toISOString();
  const mutation = existing
    ? auth.client
        .from("assignment_submissions")
        .update({
          content,
          updated_at: now,
          feedback: null,
          score: null,
          graded_by: null,
          graded_at: null,
        })
        .eq("id", existing.id)
        .eq("user_id", auth.user.id)
        .select()
        .single()
    : auth.client
        .from("assignment_submissions")
        .insert({ assignment_id: assignmentId, user_id: auth.user.id, content })
        .select()
        .single();
  const { data: submission, error } = await mutation;
  if (error || !submission) {
    return NextResponse.json({ error: error?.message || "提交失败" }, { status: 500 });
  }
  return NextResponse.json({
    submission,
    late: new Date(submission.submitted_at).getTime() > new Date(assignment.ends_at).getTime(),
  });
}
