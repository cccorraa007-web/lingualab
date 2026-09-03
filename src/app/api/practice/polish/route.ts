import { NextResponse } from "next/server";
import { polishAnswers } from "@/lib/ai/practice";
import type { ChatMessage } from "@/lib/ai/deepseek";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { history?: { role: string; content: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const messages: ChatMessage[] = (body.history ?? []).map((h) => ({
    role: h.role as "user" | "assistant",
    content: h.content,
  }));

  const polish = await polishAnswers(messages);
  return NextResponse.json({ polish });
}
