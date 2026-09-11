import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { analyzeClassroomLearning } from "@/lib/ai/learning-analysis";
import { getClassroomRole } from "../assignments/_auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function evidence(request: Request, id: string) {
  const auth = await getUserClient(request);
  if (!auth) return { response: unauthorized() };
  if (await getClassroomRole(auth.client, id, auth.user.id) !== "teacher") return { response: NextResponse.json({ error: "只有教师能查看学情分析" }, { status: 403 }) };

  const [{ data: readings }, { data: assignments }, { data: mistakeRows }, { data: members }] = await Promise.all([
    auth.client.from("classroom_readings").select("id,title,class_summary").eq("classroom_id", id),
    auth.client.from("classroom_assignments").select("id,title,class_summary").eq("classroom_id", id),
    auth.client.rpc("get_classroom_mistake_evidence", { p_classroom_id: id }),
    auth.client.from("classroom_members").select("user_id,role").eq("classroom_id", id).eq("status", "approved"),
  ]);
  const readingIds = (readings ?? []).map((x) => x.id);
  const assignmentIds = (assignments ?? []).map((x) => x.id);
  const [{ data: annotations }, { data: questions }, { data: submissions }] = await Promise.all([
    readingIds.length ? auth.client.from("reading_annotations").select("reading_id,text,note,user_id").in("reading_id", readingIds) : Promise.resolve({ data: [] }),
    readingIds.length ? auth.client.from("reading_questions").select("id,reading_id,question").in("reading_id", readingIds) : Promise.resolve({ data: [] }),
    assignmentIds.length ? auth.client.from("assignment_submissions").select("assignment_id,grade,score,feedback").in("assignment_id", assignmentIds) : Promise.resolve({ data: [] }),
  ]);
  const questionIds = (questions ?? []).map((q) => q.id);
  const actualAnswers = questionIds.length ? (await auth.client.from("reading_answers").select("question_id,answer,feedback").in("question_id", questionIds)).data ?? [] : [];
  const readingTitle = new Map((readings ?? []).map((x) => [x.id, x.title]));
  const studentIds = new Set((members ?? []).filter((x) => x.role === "student").map((x) => x.user_id));
  const questionReading = new Map((questions ?? []).map((x) => [x.id, x.reading_id]));
  const assignmentTitle = new Map((assignments ?? []).map((x) => [x.id, x.title]));
  const readingEvidence = [
    ...(readings ?? []).filter((x) => x.class_summary).map((x) => `${x.title} 班级分析：${x.class_summary}`),
    ...(annotations ?? []).filter((x) => studentIds.has(x.user_id) && x.note).map((x) => `${readingTitle.get(x.reading_id) ?? "预习"} 学生疑问/批注：${x.text}；${x.note}`),
    ...actualAnswers.filter((x) => x.feedback).map((x) => `${readingTitle.get(questionReading.get(x.question_id) ?? "") ?? "预习"} 作答：${x.answer ?? ""}；教师反馈：${x.feedback}`),
  ];
  const assignmentEvidence = [
    ...(assignments ?? []).filter((x) => x.class_summary).map((x) => `${x.title} 班级分析：${x.class_summary}`),
    ...(submissions ?? []).filter((x) => x.feedback || x.grade || x.score != null).map((x) => `${assignmentTitle.get(x.assignment_id) ?? "作业"}：等级 ${x.grade ?? x.score ?? "未评"}；教师反馈：${x.feedback ?? "无"}`),
  ];
  return { auth, readingEvidence, assignmentEvidence, mistakeEvidence: (mistakeRows ?? []).map((x: { error_type?: string; wrong?: string; correct?: string }) => `${x.error_type ?? "其他"}：${x.wrong ?? ""} → ${x.correct ?? ""}`) };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const result = await evidence(request, id);
  if ("response" in result) return result.response;
  return NextResponse.json({ evidence_counts: { readings: result.readingEvidence.length, assignments: result.assignmentEvidence.length, mistakes: result.mistakeEvidence.length } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const result = await evidence(request, id);
  if ("response" in result) return result.response;
  try { return NextResponse.json({ analysis: await analyzeClassroomLearning(result) }); }
  catch (error) { return NextResponse.json({ error: `分析失败：${error instanceof Error ? error.message : String(error)}` }, { status: 500 }); }
}
