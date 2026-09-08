import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { processCorpus } from "@/lib/ai/pipeline";
import { detectSupportedLanguage } from "@/lib/language";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  let body: { type?: string; title?: string; text?: string; reading_id?: string; keep_notes?: boolean; keep_qa?: boolean; metadata?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { type = "text", title, text, reading_id } = body;
  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  if (typeof text !== "string" || text.trim().length < 50) {
    return NextResponse.json(
      { error: "文本太短，至少需要 50 个字符" },
      { status: 400 },
    );
  }

  const lang = detectSupportedLanguage(text);
  if (lang === "other") {
    return NextResponse.json(
      { error: "目前仅支持英语和西班牙语，其他语种仍在开发中" },
      { status: 400 },
    );
  }

  const { data: material, error: mErr } = await supabase
    .from("materials")
    .insert({
      user_id: auth.user.id,
      type,
      title: title?.trim() || null,
      raw_text: text.trim(),
      reading_id: reading_id || null,
      lang,
      metadata,
    })
    .select()
    .single();
  if (mErr) {
    return NextResponse.json(
      { error: "材料保存失败: " + mErr.message },
      { status: 500 },
    );
  }

  try {
    const importContext = body.keep_notes || body.keep_qa ? `\n\n【随导入保留的学习记录，请据此生成关键词、用法和口语问题卡片】\n${JSON.stringify(metadata).slice(0, 20000)}` : "";
    const result = await processCorpus(text.trim() + importContext, lang);

    await supabase
      .from("materials")
      .update({
        tags: result.tags,
        cefr_level: result.cefr_level || null,
      })
      .eq("id", material.id)
      .eq("user_id", auth.user.id);

    const rows = result.items
      .filter((it) => typeof it.content === "string" && it.content.length > 0)
      .map((it) => ({
        user_id: auth.user.id,
        material_id: material.id,
        category: it.category,
        content: it.content,
        zh: it.zh ?? null,
        extra: it.extra ?? {},
        snippet: it.snippet ?? null,
        snippet_zh: it.snippet_zh ?? null,
        status: "draft",
      }));

    let items: unknown[] = [];
    if (rows.length > 0) {
      const { data, error } = await supabase
        .from("corpus_cards")
        .insert(rows)
        .select();
      if (error) throw error;
      items = data ?? [];
    }

    return NextResponse.json({
      materialId: material.id,
      title: material.title,
      tags: result.tags,
      cefr_level: result.cefr_level,
      items,
    });
  } catch (e) {
    await supabase.from("materials").delete().eq("id", material.id);
    return NextResponse.json(
      { error: "AI 处理失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const tag = searchParams.get("tag");
  const lang = searchParams.get("lang");

  let query = supabase
    .from("materials")
    .select("id, title, type, tags, cefr_level, lang, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (lang === "es" || lang === "en") {
    query = query.eq("lang", lang);
  }
  if (tag) {
    query = query.contains("tags", [tag]);
  }
  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ materials: data ?? [] });
}
