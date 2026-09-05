import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  let body: {
    material_id?: string;
    text?: string;
    color?: string;
    note?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { material_id, text, color = "yellow", note } = body;
  if (!material_id || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json(
      { error: "缺少 material_id 或 text" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("annotations")
    .insert({
      user_id: auth.user.id,
      material_id,
      text: text.trim(),
      color: color || "yellow",
      note: note?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ annotation: data });
}
