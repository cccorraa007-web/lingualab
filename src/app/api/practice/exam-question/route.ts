import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { generateExamQuestion } from "@/lib/ai/practice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  let body: { type?: string; lang?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const type = body.type || "t1";
  const lang = body.lang === "en" ? "en" : "es";

  const { data: materials } = await supabase
    .from("materials")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("lang", lang);
  const materialIds = (materials ?? []).map((m) => m.id);

  let prompts: { content: string }[] = [];
  if (materialIds.length > 0) {
    const { data } = await supabase
      .from("corpus_cards")
      .select("content")
      .eq("user_id", auth.user.id)
      .eq("status", "saved")
      .eq("category", "prompt")
      .in("material_id", materialIds);
    prompts = data ?? [];
  }

  const context = prompts.map((p) => p.content).join("\n");

  try {
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
