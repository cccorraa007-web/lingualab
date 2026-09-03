export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callDeepSeek(
  messages: ChatMessage[],
  options: { json?: boolean; temperature?: number } = {},
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 DEEPSEEK_API_KEY 环境变量");
  }

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
      temperature: options.temperature ?? 0.3,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek API 错误 ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek 返回内容为空");
  }
  return content;
}

export async function chatJSON<T>(messages: ChatMessage[]): Promise<T> {
  const content = await callDeepSeek(messages, { json: true });
  const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as T;
    }
    throw new Error("DeepSeek 返回了无法解析的内容");
  }
}

export async function chatText(
  messages: ChatMessage[],
  temperature = 0.7,
): Promise<string> {
  return callDeepSeek(messages, { temperature });
}
