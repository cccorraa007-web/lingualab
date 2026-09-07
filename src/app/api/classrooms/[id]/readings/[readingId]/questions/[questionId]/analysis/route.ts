import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { analyzeClassAnswers } from "@/lib/ai/analysis";
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
  { params }: {
    params: Promise<{ id: string; readingId: string; questionId: string }>;
  },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id, readingId, questionId } = await params;
  const role = await myRole(supabase, auth.user.id, id);
  if (role !== "teacher") {
    return NextResponse.json({ error: "只有教师能查看班级分析" }, { status: 403 });
  }

  const { data: question, error: qErr } = await supabase
    .from("reading_questions")
    .select("sentence, question")
    .eq("id", questionId)
    .eq("reading_id", readingId)
    .single();
  if (qErr || !question) {
    return NextResponse.json({ error: "题目不存在" }, { status: 404 });
  }

  const { data: classroom } = await supabase
    .from("classrooms")
    .select("lang")
    .eq("id", id)
    .maybeSingle();
  const lang = parseTargetLang(classroom?.lang);

  const { data: answers } = await supabase
    .from("reading_answers")
    .select("email, answer")
    .eq("question_id", questionId);

  const { data: teacherMembers } = await supabase
    .from("classroom_members")
    .select("user_id")
    .eq("classroom_id", id)
    .eq("role", "teacher")
    .eq("status", "approved");
  const teacherIds = new Set((teacherMembers ?? []).map((m) => m.user_id));

  const { data: annotations } = await supabase
    .from("reading_annotations")
    .select("user_id, text")
    .eq("reading_id", readingId);

  try {
    const analysis = await analyzeClassAnswers({
      question: question.question,
      sentence: question.sentence,
      answers: (answers ?? []).map((a) => ({
        email: a.email ?? "学生",
        answer: a.answer ?? "",
      })),
      // 只统计学生的勾画词（排除教师自己的备课笔记）。
      annotationWords: (annotations ?? [])
        .filter((a) => !teacherIds.has(a.user_id))
        .map((a) => a.text),
      lang,
    });
    return NextResponse.json({ analysis });
  } catch (e) {
    return NextResponse.json(
      { error: "分析失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}
