import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/client";
import { processCorpus } from "@/lib/ai/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { type?: string; title?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { type = "text", title, text } = body;
  if (typeof text !== "string" || text.trim().length < 50) {
    return NextResponse.json(
      { error: "文本太短，至少需要 50 个字符" },
      { status: 400 },
    );
  }

  const supabase = getSupabase();

  const { data: material, error: mErr } = await supabase
    .from("materials")
    .insert({ type, title: title?.trim() || null, raw_text: text.trim() })
    .select()
    .single();
  if (mErr) {
    return NextResponse.json(
      { error: "材料保存失败: " + mErr.message },
      { status: 500 },
    );
  }

  try {
    const result = await processCorpus(text.trim());

    await supabase
      .from("materials")
      .update({
        tags: result.tags,
        cefr_level: result.cefr_level || null,
      })
      .eq("id", material.id);

    const rows = result.items
      .filter((it) => typeof it.content === "string" && it.content.length > 0)
      .map((it) => ({
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
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const tag = searchParams.get("tag");

  const supabase = getSupabase();
  let query = supabase
    .from("materials")
    .select("id, title, type, tags, cefr_level, created_at")
    .order("created_at", { ascending: false });

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
