import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { generateExamQuestion } from "@/lib/ai/practice";
import { detectLanguage } from "@/lib/language";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  let body: { type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const type = body.type || "t1";

  const { data: prompts } = await supabase
    .from("corpus_cards")
    .select("content")
    .eq("user_id", auth.user.id)
    .eq("status", "saved")
    .eq("category", "prompt");

  const context = (prompts ?? [])
    .map((p) => p.content)
    .join("\n");

  try {
    const lang = detectLanguage(context);
    const content = await generateExamQuestion(type, context, lang);
    return NextResponse.json({
      question: { content, zh: null, extra: {} },
      lang,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "出题失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}
