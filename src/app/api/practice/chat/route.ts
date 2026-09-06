import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { chatReply } from "@/lib/ai/practice";
import type { ChatMessage } from "@/lib/ai/deepseek";
import { detectLanguage } from "@/lib/language";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function getTopicContext(
  supabase: SupabaseClient,
  userId: string,
  topic: string,
): Promise<string> {
  const { data: materials } = await supabase
    .from("materials")
    .select("id, title")
    .eq("user_id", userId)
    .contains("tags", [topic]);

  if (!materials?.length) {
    return "（暂无该话题的语料内容，请根据话题本身和常识自由提问）";
  }

  const ids = materials.map((m) => m.id);
  const { data: cards } = await supabase
    .from("corpus_cards")
    .select("category, content, zh")
    .eq("user_id", userId)
    .eq("status", "saved")
    .in("material_id", ids);

  const lines: string[] = [];
  for (const m of materials) {
    lines.push(`文章《${m.title || "未命名"}》`);
  }
  for (const c of cards ?? []) {
    lines.push(`[${c.category}] ${c.content}${c.zh ? ` (${c.zh})` : ""}`);
  }
  return lines.join("\n");
}

export async function POST(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();

  let body: { topic?: string; history?: { role: string; content: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { topic, history } = body;
  if (!topic) {
    return NextResponse.json({ error: "缺少 topic" }, { status: 400 });
  }

  const messages: ChatMessage[] = (history ?? []).map((h) => ({
    role: h.role as "user" | "assistant",
    content: h.content,
  }));

  const context = await getTopicContext(auth.client, auth.user.id, topic);
  const lang = detectLanguage(context);
  const reply = await chatReply(context, messages, lang);
  return NextResponse.json({ reply, lang });
}
