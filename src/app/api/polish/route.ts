import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { polishWriting } from "@/lib/ai/writing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    body = parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const essay = typeof body.essay === "string" ? body.essay.trim() : "";
  const rubric = typeof body.rubric === "string" ? body.rubric.trim() : "";
  const lang = body.lang === "es" || body.lang === "en" ? body.lang : null;

  if (!lang) return NextResponse.json({ error: "请选择写作语言" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "请填写作文题目" }, { status: 400 });
  if (essay.length < 20) {
    return NextResponse.json({ error: "作文正文至少需要 20 个字符" }, { status: 400 });
  }
  if (title.length > 500) {
    return NextResponse.json({ error: "作文题目不能超过 500 个字符" }, { status: 400 });
  }
  if (essay.length > 12_000) {
    return NextResponse.json({ error: "作文正文不能超过 12000 个字符" }, { status: 400 });
  }
  if (rubric.length > 4_000) {
    return NextResponse.json({ error: "评分标准不能超过 4000 个字符" }, { status: 400 });
  }

  try {
    const result = await polishWriting(
      { title, essay, rubric: rubric || undefined },
      lang,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("写作润色失败", error);
    return NextResponse.json(
      { error: "AI 暂时无法完成润色，请稍后重试" },
      { status: 502 },
    );
  }
}
