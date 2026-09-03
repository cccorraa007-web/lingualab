import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/client";
import { evaluateInterpreting } from "@/lib/ai/practice";
import type { InterpretingMistake } from "@/lib/ai/practice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { id?: string; answer?: string; prompt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { id, answer, prompt } = body;
  if (!id || !answer?.trim() || !prompt) {
    return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: mistake, error: mErr } = await supabase
    .from("mistake_book")
    .select("*")
    .eq("id", id)
    .single();
  if (mErr || !mistake) {
    return NextResponse.json({ error: "错题不存在" }, { status: 404 });
  }

  const { correct, feedback } = await evaluateInterpreting(
    mistake as InterpretingMistake,
    prompt,
    answer.trim(),
  );

  if (correct) {
    const newStreak = (mistake.correct_streak ?? 0) + 1;
    if (newStreak >= 3) {
      await supabase.from("mistake_book").delete().eq("id", id);
      return NextResponse.json({
        correct: true,
        feedback,
        removed: true,
        streak: newStreak,
      });
    }
    await supabase
      .from("mistake_book")
      .update({
        correct_streak: newStreak,
        last_reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    return NextResponse.json({
      correct: true,
      feedback,
      removed: false,
      streak: newStreak,
    });
  }

  const newCount = (mistake.wrong_count ?? 0) + 1;
  await supabase
    .from("mistake_book")
    .update({
      wrong_count: newCount,
      correct_streak: 0,
      last_reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  return NextResponse.json({
    correct: false,
    feedback,
    removed: false,
    streak: 0,
  });
}
