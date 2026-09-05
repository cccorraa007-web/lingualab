import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  let body: { ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { ids } = body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: "缺少要保存的卡片 ids" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("corpus_cards")
    .update({ status: "saved" })
    .in("id", ids)
    .eq("user_id", auth.user.id)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ count: data?.length ?? 0 });
}

export async function POST(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  let body: {
    material_id?: string;
    category?: string;
    content?: string;
    zh?: string;
    extra?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { material_id, category = "expression", content, zh, extra } = body;
  if (typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
  }
  if (!material_id) {
    return NextResponse.json({ error: "缺少 material_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("corpus_cards")
    .insert({
      user_id: auth.user.id,
      material_id,
      category,
      content: content.trim(),
      zh: zh || null,
      extra: extra ?? {},
      status: "saved",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ card: data });
}
