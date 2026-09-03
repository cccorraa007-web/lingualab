import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/client";
import { translateText } from "@/lib/ai/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getSupabase();

  const { data: material, error: mErr } = await supabase
    .from("materials")
    .select("raw_text, translation")
    .eq("id", id)
    .single();
  if (mErr) {
    return NextResponse.json({ error: "材料不存在" }, { status: 404 });
  }

  if (material.translation) {
    return NextResponse.json({ translation: material.translation });
  }

  try {
    const translation = await translateText(material.raw_text);
    await supabase.from("materials").update({ translation }).eq("id", id);
    return NextResponse.json({ translation });
  } catch (e) {
    return NextResponse.json(
      { error: "翻译失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}
