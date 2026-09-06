import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { canManageAssignments, getClassroomRole } from "../../_auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; assignmentId: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const { id: classroomId, assignmentId } = await params;
  const role = await getClassroomRole(auth.client, classroomId, auth.user.id);
  if (!role || !canManageAssignments(role)) {
    return NextResponse.json({ error: "只有教师可以批改作业" }, { status: 403 });
  }

  let body: { submission_id?: unknown; feedback?: unknown; score?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const submissionId = typeof body.submission_id === "string" ? body.submission_id : "";
  const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
  const score = body.score === "" || body.score === null || body.score === undefined
    ? null
    : Number(body.score);
  if (!submissionId || (!feedback && score === null)) {
    return NextResponse.json({ error: "请填写反馈或分数" }, { status: 400 });
  }
  if (feedback.length > 8_000) {
    return NextResponse.json({ error: "反馈不能超过 8000 个字符" }, { status: 400 });
  }
  if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) {
    return NextResponse.json({ error: "分数必须在 0 到 100 之间" }, { status: 400 });
  }

  const { data: assignment } = await auth.client
    .from("classroom_assignments")
    .select("id")
    .eq("id", assignmentId)
    .eq("classroom_id", classroomId)
    .maybeSingle();
  if (!assignment) return NextResponse.json({ error: "作业不存在" }, { status: 404 });

  const { data: submission, error } = await auth.client
    .from("assignment_submissions")
    .update({
      feedback: feedback || null,
      score,
      max_score: 100,
      graded_by: auth.user.id,
      graded_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("assignment_id", assignmentId)
    .select()
    .single();
  if (error || !submission) {
    return NextResponse.json({ error: error?.message || "批改失败" }, { status: 500 });
  }
  return NextResponse.json({ submission });
}
