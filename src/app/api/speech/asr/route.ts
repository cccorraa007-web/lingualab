import { NextResponse } from "next/server";
import { recognizeSpeech } from "@/lib/aliyun/speech";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let format = "wav";
  let sampleRate = 16000;
  const url = new URL(request.url);
  const fmtParam = url.searchParams.get("format");
  if (fmtParam) format = fmtParam;
  const srParam = url.searchParams.get("sample_rate");
  if (srParam) sampleRate = Number(srParam) || 16000;

  const audio = await request.arrayBuffer();
  if (audio.byteLength === 0) {
    return NextResponse.json({ error: "音频为空" }, { status: 400 });
  }

  try {
    const text = await recognizeSpeech(audio, format, sampleRate);
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
