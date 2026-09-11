import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { getClassroomRole } from "../_auth";

export const dynamic = "force-dynamic";
const GRADE_POINTS: Record<string, number> = { "A+": 100, A: 95, "B+": 88, B: 82, "C+": 75, C: 68, D: 60 };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getUserClient(request); if (!auth) return unauthorized(); const { id } = await params;
  const role = await getClassroomRole(auth.client, id, auth.user.id);
  if (!role) return NextResponse.json({ error: "你不是该班级成员" }, { status: 403 });

  const [{ data: assignments }, { data: members }, { data: readings }] = await Promise.all([
    auth.client.from("classroom_assignments").select("id, ends_at").eq("classroom_id", id),
    auth.client.from("classroom_members").select("user_id, email, role").eq("classroom_id", id).eq("status", "approved"),
    auth.client.from("classroom_readings").select("id").eq("classroom_id", id),
  ]);

  const assignmentIds = (assignments ?? []).map((item) => item.id);
  const readingIds = (readings ?? []).map((item) => item.id);

  const { data: submissions } = assignmentIds.length ? await auth.client.from("assignment_submissions").select("assignment_id, user_id, submitted_at, grade, score").in("assignment_id", assignmentIds) : { data: [] };

  const questionCountByReading: Record<string, number> = {};
  let readingAnswers: { user_id: string; reading_id: string }[] = [];
  if (readingIds.length) {
    const { data: questions } = await auth.client.from("reading_questions").select("id, reading_id").in("reading_id", readingIds);
    const questionList = questions ?? [];
    for (const q of questionList) {
      questionCountByReading[q.reading_id] = (questionCountByReading[q.reading_id] ?? 0) + 1;
    }
    const questionIds = questionList.map((q) => q.id);
    if (questionIds.length) {
      const { data: answers } = await auth.client.from("reading_answers").select("user_id, question_id").in("question_id", questionIds);
      const questionToReading = new Map(questionList.map((q) => [q.id, q.reading_id]));
      readingAnswers = (answers ?? []).map((a) => ({ user_id: a.user_id, reading_id: questionToReading.get(a.question_id) ?? "" })).filter((a) => a.reading_id);
    }
  }

  const readingCount = readingIds.filter((rid) => (questionCountByReading[rid] ?? 0) > 0).length;
  const totalCount = assignmentIds.length + readingCount;

  const students = (members ?? []).filter((item) => item.role === "student");
  const stats = students.map((student) => {
    const mine = (submissions ?? []).filter((item) => item.user_id === student.user_id);
    const onTime = mine.filter((item) => { const assignment = (assignments ?? []).find((a) => a.id === item.assignment_id); return assignment && new Date(item.submitted_at) <= new Date(assignment.ends_at); }).length;
    const grades = mine.map((item) => item.grade as string | null).filter((grade): grade is string => Boolean(grade && GRADE_POINTS[grade]));
    const legacyScores = mine.filter((item) => !item.grade && typeof item.score === "number").map((item) => item.score as number);
    const gradeAverage = grades.length || legacyScores.length ? (grades.reduce((sum, grade) => sum + GRADE_POINTS[grade], 0) + legacyScores.reduce((sum, score) => sum + score, 0)) / (grades.length + legacyScores.length) : 0;

    const answeredByReading: Record<string, number> = {};
    for (const a of readingAnswers) {
      if (a.user_id !== student.user_id) continue;
      answeredByReading[a.reading_id] = (answeredByReading[a.reading_id] ?? 0) + 1;
    }
    let doneReadings = 0;
    for (const rid of readingIds) {
      const qc = questionCountByReading[rid] ?? 0;
      if (qc > 0 && (answeredByReading[rid] ?? 0) >= qc) doneReadings += 1;
    }

    const submitted = mine.length + doneReadings;
    const submissionRate = totalCount ? submitted / totalCount : 0;
    const onTimeRate = assignmentIds.length ? onTime / assignmentIds.length : 0;
    const qualityRate = gradeAverage / 100;
    // 完成度、按时率和教师评分分别计分，避免“交了但迟交”与按时完成同分。
    const rank_score = submissionRate * 35 + onTimeRate * 25 + qualityRate * 40;
    return { user_id: student.user_id, email: student.email ?? "学生", submitted, total: totalCount, on_time: onTime, assignment_total: assignmentIds.length, submission_rate: submissionRate, on_time_rate: onTimeRate, grade_average: gradeAverage, done_readings: doneReadings, grade_distribution: Object.fromEntries(grades.map((grade) => [grade, grades.filter((g) => g === grade).length])), rank_score };
  }).sort((a, b) => b.rank_score - a.rank_score);

  const self = stats.find((item) => item.user_id === auth.user.id) ?? null;
  const top_three = stats.slice(0, 3).map(({ email, submitted, total, on_time, done_readings, grade_distribution }) => ({ email, submitted, total, on_time, done_readings, grade_distribution }));
  let analyses: { type: "预习" | "课后作业"; title: string; summary: string; analyzed_at: string | null }[] = [];
  if (role === "teacher") {
    const [{ data: readingAnalysis }, { data: assignmentAnalysis }] = await Promise.all([
      auth.client.from("classroom_readings").select("title, class_summary, class_analysis_at").eq("classroom_id", id).not("class_summary", "is", null),
      auth.client.from("classroom_assignments").select("title, class_summary, class_analysis_at").eq("classroom_id", id).not("class_summary", "is", null),
    ]);
    analyses = [
      ...(readingAnalysis ?? []).map((item) => ({ type: "预习" as const, title: item.title, summary: item.class_summary ?? "", analyzed_at: item.class_analysis_at })),
      ...(assignmentAnalysis ?? []).map((item) => ({ type: "课后作业" as const, title: item.title, summary: item.class_summary ?? "", analyzed_at: item.class_analysis_at })),
    ].sort((a, b) => new Date(b.analyzed_at ?? 0).getTime() - new Date(a.analyzed_at ?? 0).getTime());
  }
  return NextResponse.json({ self, top_three, total_assignments: totalCount, all_students: role === "teacher" ? stats : undefined, ranking: role === "teacher" ? stats : undefined, analyses: role === "teacher" ? analyses : undefined });
}
