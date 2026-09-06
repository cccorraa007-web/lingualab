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
  { params }: { params: Promise<{ id: string; readingId: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id, readingId } = await params;
  const role = await myRole(supabase, auth.user.id, id);
  if (!role) {
    return NextResponse.json({ error: "你不是该班级成员" }, { status: 403 });
  }

  const { data: reading, error: rErr } = await supabase
    .from("classroom_readings")
    .select("*")
    .eq("id", readingId)
    .eq("classroom_id", id)
    .single();
  if (rErr || !reading) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  const { data: annotations, error: aErr } = await supabase
    .from("reading_annotations")
    .select("*")
    .eq("reading_id", readingId)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true });
  if (aErr) {
    return NextResponse.json({ error: aErr.message }, { status: 500 });
  }

  const { data: existingMaterial } = await supabase
    .from("materials")
    .select("id")
    .eq("reading_id", readingId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  const addedToCorpus = Boolean(existingMaterial);

  const { data: questions, error: qErr } = await supabase
    .from("reading_questions")
    .select("*")
    .eq("reading_id", readingId)
    .order("created_at", { ascending: true });
  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  const questionIds = (questions ?? []).map((q) => q.id);
  let answers: unknown[] = [];
  if (questionIds.length > 0) {
    let q = supabase
      .from("reading_answers")
      .select("*")
      .in("question_id", questionIds);
    if (role !== "teacher") {
      q = q.eq("user_id", auth.user.id);
    }
    const { data: ans, error: ansErr } = await q;
    if (ansErr) {
      return NextResponse.json({ error: ansErr.message }, { status: 500 });
    }
    answers = ans ?? [];
  }

  return NextResponse.json({
    reading,
    annotations: annotations ?? [],
    questions: questions ?? [],
    answers,
    added_to_corpus: addedToCorpus,
    my_role: role,
  });
}
