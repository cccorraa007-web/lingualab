import { NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/aliyun/speech";
import { langMeta, parseTargetLang } from "@/lib/language";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { text?: string; lang?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return NextResponse.json({ error: "缺少 text" }, { status: 400 });
  }

  const lang = parseTargetLang(body.lang);
  const voice = langMeta(lang).ttsVoice;

  try {
    const buffers = await synthesizeSpeech(body.text.trim(), voice);
    const segments = buffers.map(
      (buf) => `data:audio/mpeg;base64,${Buffer.from(buf).toString("base64")}`,
    );
    return NextResponse.json({ segments });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
