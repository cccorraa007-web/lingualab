import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/client";
import { generateExamQuestion } from "@/lib/ai/practice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const type = body.type || "t1";
  const supabase = getSupabase();

  const { data: prompts } = await supabase
    .from("corpus_cards")
    .select("content")
    .eq("status", "saved")
    .eq("category", "prompt");

  const context = (prompts ?? [])
    .map((p) => p.content)
    .join("\n");

  try {
    const content = await generateExamQuestion(type, context);
    return NextResponse.json({
      question: { content, zh: null, extra: {} },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "出题失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}
