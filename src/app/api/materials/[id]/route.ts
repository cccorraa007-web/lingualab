import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id } = await params;

  const { data: material, error: mErr } = await supabase
    .from("materials")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .single();
  if (mErr) {
    return NextResponse.json(
      { error: "材料不存在: " + mErr.message },
      { status: 404 },
    );
  }

  const { data: cards, error: cErr } = await supabase
    .from("corpus_cards")
    .select("*")
    .eq("material_id", id)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true });
  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  const { data: annotations, error: aErr } = await supabase
    .from("annotations")
    .select("*")
    .eq("material_id", id)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true });
  if (aErr) {
    return NextResponse.json({ error: aErr.message }, { status: 500 });
  }

  return NextResponse.json({
    material,
    cards: cards ?? [],
    annotations: annotations ?? [],
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id } = await params;
  let body: { title?: string | null; tags?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.title === "string" || body.title === null) {
    update.title = body.title;
  }
  if (Array.isArray(body.tags)) {
    update.tags = body.tags;
  }

  const { data, error } = await supabase
    .from("materials")
    .update(update)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ material: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id } = await params;

  const { error } = await supabase
    .from("materials")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
