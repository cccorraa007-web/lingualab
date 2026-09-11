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

  const [{ data: reading, error: rErr }, { data: annotations, error: aErr }, { data: existingMaterial }, { data: questions, error: qErr }, { data: classroom }] =
    await Promise.all([
      supabase
        .from("classroom_readings")
        .select("*")
        .eq("id", readingId)
        .eq("classroom_id", id)
        .single(),
      supabase
        .from("reading_annotations")
        .select("*")
        .eq("reading_id", readingId)
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("materials")
        .select("id")
        .eq("reading_id", readingId)
        .eq("user_id", auth.user.id)
        .maybeSingle(),
      supabase
        .from("reading_questions")
        .select("*")
        .eq("reading_id", readingId)
        .order("created_at", { ascending: true }),
      supabase
        .from("classrooms")
        .select("lang")
        .eq("id", id)
        .maybeSingle(),
    ]);
  if (rErr || !reading) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }
  if (aErr) {
    return NextResponse.json({ error: aErr.message }, { status: 500 });
  }
  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }
  const addedToCorpus = Boolean(existingMaterial);

  let studentAnnotations: { email: string; text: string; note: string | null }[] = [];
  if (role === "teacher") {
    const { data: stuAnno } = await supabase
      .from("reading_annotations")
      .select("user_id, text, note")
      .eq("reading_id", readingId)
      .neq("user_id", auth.user.id)
      .order("created_at", { ascending: true });

    const userIds = [...new Set((stuAnno ?? []).map((a) => a.user_id))];
    const emailByUser = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: members } = await supabase
        .from("classroom_members")
        .select("user_id, email")
        .eq("classroom_id", id)
        .in("user_id", userIds);
      for (const m of members ?? []) {
        if (m.email) emailByUser.set(m.user_id, m.email);
      }
    }
    studentAnnotations = (stuAnno ?? []).map((a) => ({
      email: emailByUser.get(a.user_id) ?? "学生",
      text: a.text,
      note: a.note ?? null,
    }));
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
    student_annotations: studentAnnotations,
    questions: questions ?? [],
    answers,
    added_to_corpus: addedToCorpus,
    my_role: role,
    lang: classroom?.lang === "en" ? "en" : "es",
  });
}
