import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import {
  evaluateMistakePractice,
  type MistakePracticeItem,
  type MistakePracticeMode,
} from "@/lib/ai/writing";
import { detectLanguage } from "@/lib/language";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  let body: { id?: string; answer?: string; prompt?: string; mode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { id, answer, prompt, mode = "interpret" } = body;
  if (!id || !answer?.trim() || !prompt) {
    return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  }
  if (mode !== "interpret" && mode !== "translate") {
    return NextResponse.json({ error: "练习模式不正确" }, { status: 400 });
  }
  if (answer.length > 4_000 || prompt.length > 2_000) {
    return NextResponse.json({ error: "练习内容过长" }, { status: 400 });
  }

  const { data: mistake, error: mErr } = await supabase
    .from("mistake_book")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .single();
  if (mErr || !mistake) {
    return NextResponse.json({ error: "错题不存在" }, { status: 404 });
  }

  let evaluation: { correct: boolean; feedback: string };
  try {
    evaluation = await evaluateMistakePractice(
      mistake as MistakePracticeItem,
      prompt,
      answer.trim(),
      mode as MistakePracticeMode,
      detectLanguage(`${mistake.correct} ${mistake.wrong} ${mistake.example ?? ""}`),
    );
  } catch (evaluationError) {
    console.error("评价错题练习失败", evaluationError);
    return NextResponse.json(
      { error: "AI 暂时无法评价答案，请稍后重试" },
      { status: 502 },
    );
  }
  const { correct, feedback } = evaluation;

  if (correct) {
    const newStreak = (mistake.correct_streak ?? 0) + 1;
    if (newStreak >= 3) {
      await supabase
        .from("mistake_book")
        .delete()
        .eq("id", id)
        .eq("user_id", auth.user.id);
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
      .eq("id", id)
      .eq("user_id", auth.user.id);
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
    .eq("id", id)
    .eq("user_id", auth.user.id);
  return NextResponse.json({
    correct: false,
    feedback,
    removed: false,
    streak: 0,
  });
}
