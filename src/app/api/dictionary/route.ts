import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { lookupWord } from "@/lib/ai/dictionary";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();

  let body: { word?: unknown; lang?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const word = typeof body.word === "string" ? body.word.trim() : "";
  if (!word) {
    return NextResponse.json({ error: "缺少要查询的词语" }, { status: 400 });
  }
  if (word.length > 80) {
    return NextResponse.json(
      { error: "内容过长，请选择单词或短语" },
      { status: 400 },
    );
  }

  const lang: "es" | "en" = body.lang === "en" ? "en" : "es";

  try {
    const entry = await lookupWord(word, lang);
    return NextResponse.json({ entry });
  } catch (e) {
    return NextResponse.json(
      { error: "查询失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}
