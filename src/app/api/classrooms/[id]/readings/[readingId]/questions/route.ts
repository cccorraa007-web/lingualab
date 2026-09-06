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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; readingId: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id, readingId } = await params;
  const role = await myRole(supabase, auth.user.id, id);
  if (role !== "teacher") {
    return NextResponse.json({ error: "只有教师或班委能添加题目" }, { status: 403 });
  }

  let body: { sentence?: string; question?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!body.sentence?.trim() || !body.question?.trim()) {
    return NextResponse.json({ error: "缺少句子或题目" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("reading_questions")
    .insert({
      reading_id: readingId,
      sentence: body.sentence.trim(),
      question: body.question.trim(),
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ question: data });
}
