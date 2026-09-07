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
  { params }: {
    params: Promise<{ id: string; readingId: string; questionId: string }>;
  },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id, readingId, questionId } = await params;
  const role = await myRole(supabase, auth.user.id, id);
  if (!role) {
    return NextResponse.json({ error: "你不是该班级成员" }, { status: 403 });
  }

  const { data: question, error: qErr } = await supabase
    .from("reading_questions")
    .select("*")
    .eq("id", questionId)
    .eq("reading_id", readingId)
    .single();
  if (qErr || !question) {
    return NextResponse.json({ error: "题目不存在" }, { status: 404 });
  }

  const { data: reading } = await supabase
    .from("classroom_readings")
    .select("title")
    .eq("id", readingId)
    .single();

  if (role === "student") {
    const { data: my } = await supabase
      .from("reading_answers")
      .select("*")
      .eq("question_id", questionId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    return NextResponse.json({
      question,
      reading_title: reading?.title ?? "",
      my_role: role,
      my_answer: my ?? null,
    });
  }

  const { data: answers } = await supabase
    .from("reading_answers")
    .select("*")
    .eq("question_id", questionId)
    .order("created_at", { ascending: true });

  const { data: students } = await supabase
    .from("classroom_members")
    .select("user_id, email")
    .eq("classroom_id", id)
    .eq("role", "student")
    .eq("status", "approved");

  return NextResponse.json({
    question,
    reading_title: reading?.title ?? "",
    my_role: role,
    answers: answers ?? [],
    students: students ?? [],
  });
}

export async function DELETE(
  request: Request,
  { params }: {
    params: Promise<{ id: string; readingId: string; questionId: string }>;
  },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id, readingId, questionId } = await params;
  const role = await myRole(supabase, auth.user.id, id);
  if (role !== "teacher") {
    return NextResponse.json({ error: "没有删除权限" }, { status: 403 });
  }

  const { error } = await supabase
    .from("reading_questions")
    .delete()
    .eq("id", questionId)
    .eq("reading_id", readingId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
