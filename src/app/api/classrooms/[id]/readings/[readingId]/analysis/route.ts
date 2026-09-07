import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { analyzeReadingClass } from "@/lib/ai/analysis";
import { parseTargetLang } from "@/lib/language";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function myRole(
  supabase: SupabaseClient,
  userId: string,
  classroomId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("classroom_members")
    .select("role")
    .eq("classroom_id", classroomId)
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();
  return (data?.role as string) ?? null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; readingId: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id, readingId } = await params;
  const role = await myRole(supabase, auth.user.id, id);
  if (role !== "teacher") {
    return NextResponse.json({ error: "只有教师能查看班级作答分析" }, { status: 403 });
  }

  const { data: reading, error: rErr } = await supabase
    .from("classroom_readings")
    .select("title")
    .eq("id", readingId)
    .eq("classroom_id", id)
    .single();
  if (rErr || !reading) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  const { data: classroom } = await supabase
    .from("classrooms")
    .select("lang")
    .eq("id", id)
    .maybeSingle();
  const lang = parseTargetLang(classroom?.lang);

  const { data: questions } = await supabase
    .from("reading_questions")
    .select("id, sentence, question")
    .eq("reading_id", readingId)
    .order("created_at", { ascending: true });

  const questionList = questions ?? [];
  const questionTextById = new Map(
    questionList.map((q) => [q.id, q.question as string]),
  );

  const { data: answers } = await supabase
    .from("reading_answers")
    .select("email, answer, feedback, question_id")
    .in(
      "question_id",
      questionList.map((q) => q.id),
    );

  const { data: annotations } = await supabase
    .from("reading_annotations")
    .select("user_id, text, note")
    .eq("reading_id", readingId);

  const { data: members } = await supabase
    .from("classroom_members")
    .select("user_id, email, role")
    .eq("classroom_id", id)
    .eq("status", "approved");

  const emailByUser = new Map<string, string>();
  const studentEmails = new Set<string>();
  for (const m of members ?? []) {
    if (m.email) emailByUser.set(m.user_id, m.email);
    if (m.role === "student" && m.email) studentEmails.add(m.email);
  }

  const studentData = new Map<
    string,
    {
      answers: { question: string; answer: string; feedback: string }[];
      annotations: { text: string; note: string }[];
    }
  >();
  const ensure = (email: string) => {
    if (!studentData.has(email)) {
      studentData.set(email, { answers: [], annotations: [] });
    }
    return studentData.get(email)!;
  };

  for (const a of answers ?? []) {
    const email = a.email ?? "";
    if (!email) continue;
    const entry = ensure(email);
    entry.answers.push({
      question: questionTextById.get(a.question_id) ?? "",
      answer: a.answer ?? "",
      feedback: a.feedback ?? "",
    });
    studentEmails.add(email);
  }

  for (const a of annotations ?? []) {
    const email = emailByUser.get(a.user_id) ?? "";
    if (!email) continue;
    const entry = ensure(email);
    entry.annotations.push({ text: a.text, note: a.note ?? "" });
    studentEmails.add(email);
  }

  const studentArray = [...studentEmails].map((email) => ({
    email,
    answers: studentData.get(email)?.answers ?? [],
    annotations: studentData.get(email)?.annotations ?? [],
  }));

  try {
    const analysis = await analyzeReadingClass({
      title: reading.title,
      questions: questionList.map((q) => ({
        sentence: q.sentence,
        question: q.question,
      })),
      studentData: studentArray,
      lang,
    });

    await supabase
      .from("classroom_readings")
      .update({
        class_summary: analysis.classSummary,
        class_analysis_at: new Date().toISOString(),
      })
      .eq("id", readingId);

    return NextResponse.json({ analysis });
  } catch (e) {
    return NextResponse.json(
      { error: "分析失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}
