import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { polishAnswers } from "@/lib/ai/practice";
import type { ChatMessage } from "@/lib/ai/deepseek";
import { detectLanguage } from "@/lib/language";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();

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

  const lang = detectLanguage(
    messages.map((m) => m.content).join("\n"),
  );
  const polish = await polishAnswers(messages, lang);
  return NextResponse.json({ polish });
}
