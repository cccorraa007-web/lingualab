import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: {
    error_type?: string;
    wrong?: string;
    correct?: string;
    example?: string | null;
    note?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const supabase = getSupabase();
  const update: Record<string, unknown> = {};
  if (typeof body.error_type === "string") update.error_type = body.error_type;
  if (typeof body.wrong === "string") update.wrong = body.wrong;
  if (typeof body.correct === "string") update.correct = body.correct;
  if (body.example !== undefined) update.example = body.example;
  if (body.note !== undefined) update.note = body.note;

  const { data, error } = await supabase
    .from("mistake_book")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ mistake: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getSupabase();

  const { error } = await supabase.from("mistake_book").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
