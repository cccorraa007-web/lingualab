import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

async function myRole(
  supabase: SupabaseClient,
  userId: string,
  classroomId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("classroom_members")
    .select("role")
    .eq("classroom_id", classroomId)
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();
  return (data?.role as string) ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id } = await params;
  const role = await myRole(supabase, auth.user.id, id);
  if (!role) {
    return NextResponse.json({ error: "你不是该班级成员" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("classroom_readings")
    .select("*")
    .eq("classroom_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ readings: data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id } = await params;
  const role = await myRole(supabase, auth.user.id, id);
  if (role !== "teacher") {
    return NextResponse.json({ error: "只有教师或班委能发布文章" }, { status: 403 });
  }

  let body: {
    title?: string;
    text?: string;
    starts_at?: string;
    ends_at?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const title = body.title?.trim();
  const text = body.text?.trim();
  if (!title || !text) {
    return NextResponse.json({ error: "缺少标题或正文" }, { status: 400 });
  }
  if (!body.ends_at) {
    return NextResponse.json({ error: "请设置截止时间" }, { status: 400 });
  }

  const { data: reading, error } = await supabase
    .from("classroom_readings")
    .insert({
      classroom_id: id,
      title,
      raw_text: text,
      starts_at: body.starts_at ? new Date(body.starts_at).toISOString() : new Date().toISOString(),
      ends_at: new Date(body.ends_at).toISOString(),
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reading });
}
