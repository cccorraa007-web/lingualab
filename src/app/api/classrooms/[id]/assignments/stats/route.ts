import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { getClassroomRole } from "../_auth";

export const dynamic = "force-dynamic";
const GRADE_POINTS: Record<string, number> = { "A+": 100, A: 95, "B+": 88, B: 82, "C+": 75, C: 68, D: 60 };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getUserClient(request); if (!auth) return unauthorized(); const { id } = await params;
  if (!await getClassroomRole(auth.client, id, auth.user.id)) return NextResponse.json({ error: "你不是该班级成员" }, { status: 403 });
  const [{ data: assignments }, { data: members }] = await Promise.all([
    auth.client.from("classroom_assignments").select("id, ends_at").eq("classroom_id", id),
    auth.client.from("classroom_members").select("user_id, email, role").eq("classroom_id", id).eq("status", "approved"),
  ]);
  const ids = (assignments ?? []).map((item) => item.id);
  const { data: submissions } = ids.length ? await auth.client.from("assignment_submissions").select("assignment_id, user_id, submitted_at, grade, score").in("assignment_id", ids) : { data: [] };
  const students = (members ?? []).filter((item) => item.role === "student");
  const stats = students.map((student) => {
    const mine = (submissions ?? []).filter((item) => item.user_id === student.user_id);
    const onTime = mine.filter((item) => { const assignment = (assignments ?? []).find((a) => a.id === item.assignment_id); return assignment && new Date(item.submitted_at) <= new Date(assignment.ends_at); }).length;
    const grades = mine.map((item) => item.grade as string | null).filter((grade): grade is string => Boolean(grade && GRADE_POINTS[grade]));
    const legacyScores = mine.filter((item) => !item.grade && typeof item.score === "number").map((item) => item.score as number);
    const gradeAverage = grades.length || legacyScores.length ? (grades.reduce((sum, grade) => sum + GRADE_POINTS[grade], 0) + legacyScores.reduce((sum, score) => sum + score, 0)) / (grades.length + legacyScores.length) : 0;
    const onTimeRate = ids.length ? onTime / ids.length : 0;
    return { user_id: student.user_id, email: student.email ?? "学生", submitted: mine.length, on_time: onTime, late: mine.length - onTime, missing: Math.max(0, ids.length - mine.length), grade_distribution: Object.fromEntries(grades.map((grade) => [grade, grades.filter((g) => g === grade).length])), rank_score: gradeAverage * 0.7 + onTimeRate * 30 };
  }).sort((a, b) => b.rank_score - a.rank_score);
  const self = stats.find((item) => item.user_id === auth.user.id) ?? null;
  const top_three = stats.slice(0, 3).map(({ email, submitted, on_time, late, missing, grade_distribution }) => ({ email, submitted, on_time, late, missing, grade_distribution }));
  return NextResponse.json({ self, top_three, total_assignments: ids.length });
}
