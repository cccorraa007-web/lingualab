import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { getClassroomRole } from "../../_auth";
import { analyzeAssignmentClass } from "@/lib/ai/assignment-analysis";
import { parseTargetLang } from "@/lib/language";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  const auth = await getUserClient(request); if (!auth) return unauthorized();
  const { id, assignmentId } = await params;
  if (await getClassroomRole(auth.client, id, auth.user.id) !== "teacher") return NextResponse.json({ error: "只有教师能查看班级作答分析" }, { status: 403 });
  const { data: assignment } = await auth.client.from("classroom_assignments").select("title, content").eq("id", assignmentId).eq("classroom_id", id).maybeSingle();
  if (!assignment) return NextResponse.json({ error: "作业不存在" }, { status: 404 });
  const [{ data: submissions }, { data: recipients }, { data: classroom }] = await Promise.all([
    auth.client.from("assignment_submissions").select("user_id, content, ocr_text, feedback, grade").eq("assignment_id", assignmentId),
    auth.client.from("assignment_recipients").select("user_id, email").eq("assignment_id", assignmentId),
    auth.client.from("classrooms").select("lang").eq("id", id).maybeSingle(),
  ]);
  const emailByUser = new Map((recipients ?? []).map((item) => [item.user_id, item.email || item.user_id]));
  try {
    const analysis = await analyzeAssignmentClass({ title: assignment.title, content: assignment.content, lang: parseTargetLang(classroom?.lang), students: (submissions ?? []).map((item) => ({ email: emailByUser.get(item.user_id) ?? item.user_id, answer: [item.content, item.ocr_text].filter(Boolean).join("\n\n"), feedback: item.feedback ?? "", grade: item.grade ?? "" })) });
    const { error } = await auth.client.from("classroom_assignments").update({ class_summary: analysis.classSummary, class_analysis_at: new Date().toISOString() }).eq("id", assignmentId).eq("classroom_id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ analysis });
  } catch (e) { return NextResponse.json({ error: `分析失败：${e instanceof Error ? e.message : String(e)}` }, { status: 500 }); }
}
