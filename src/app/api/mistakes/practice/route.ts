import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import {
  generateMistakePrompt,
  type MistakePracticeItem,
  type MistakePracticeMode,
} from "@/lib/ai/writing";
import { detectLanguage } from "@/lib/language";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;
  const mode = new URL(request.url).searchParams.get("mode") ?? "interpret";
  if (mode !== "interpret" && mode !== "translate") {
    return NextResponse.json({ error: "练习模式不正确" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("mistake_book")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("wrong_count", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json({ done: true, reason: "empty" });
  }

  const today = new Date().toDateString();
  const candidates = data.filter(
    (m) =>
      !m.last_reviewed_at ||
      new Date(m.last_reviewed_at).toDateString() !== today,
  );

  if (candidates.length === 0) {
    return NextResponse.json({ done: true, reason: "reviewed" });
  }

  const mistake = candidates[0] as MistakePracticeItem;
  const lang = detectLanguage(
    `${mistake.correct} ${mistake.wrong} ${mistake.example ?? ""}`,
  );
  try {
    const prompt = await generateMistakePrompt(
      mistake,
      mode as MistakePracticeMode,
      lang,
    );
    if (!prompt) throw new Error("AI 未生成题目");
    return NextResponse.json({ done: false, mistake, prompt, mode, lang });
  } catch (promptError) {
    console.error("生成错题练习失败", promptError);
    return NextResponse.json(
      { error: "AI 暂时无法生成练习题，请稍后重试" },
      { status: 502 },
    );
  }
}
