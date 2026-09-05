import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { translateText } from "@/lib/ai/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id } = await params;

  const { data: material, error: mErr } = await supabase
    .from("materials")
    .select("raw_text, translation")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .single();
  if (mErr) {
    return NextResponse.json({ error: "材料不存在" }, { status: 404 });
  }

  if (material.translation) {
    return NextResponse.json({ translation: material.translation });
  }

  try {
    const translation = await translateText(material.raw_text, auth.user.lang);
    await supabase
      .from("materials")
      .update({ translation })
      .eq("id", id)
      .eq("user_id", auth.user.id);
    return NextResponse.json({ translation });
  } catch (e) {
    return NextResponse.json(
      { error: "翻译失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}
