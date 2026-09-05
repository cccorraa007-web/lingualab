import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

async function isMember(
  supabase: SupabaseClient,
  userId: string,
  classroomId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("classroom_members")
    .select("id")
    .eq("classroom_id", classroomId)
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();
  return Boolean(data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; readingId: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id, readingId } = await params;
  if (!(await isMember(supabase, auth.user.id, id))) {
    return NextResponse.json({ error: "你不是该班级成员" }, { status: 403 });
  }

  let body: { text?: string; color?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!body.text?.trim()) {
    return NextResponse.json({ error: "缺少批注内容" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("reading_annotations")
    .insert({
      reading_id: readingId,
      user_id: auth.user.id,
      text: body.text.trim(),
      color: body.color || "yellow",
      note: body.note?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ annotation: data });
}
