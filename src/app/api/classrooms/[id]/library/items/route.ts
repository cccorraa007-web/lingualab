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

async function resolveTitle(
  supabase: SupabaseClient,
  source: string,
  sourceId: string,
  classroomId: string,
  userId: string,
): Promise<string | null> {
  if (source === "material") {
    const { data } = await supabase
      .from("materials")
      .select("title")
      .eq("id", sourceId)
      .eq("user_id", userId)
      .maybeSingle();
    return data?.title ?? null;
  }
  if (source === "reading") {
    const { data } = await supabase
      .from("classroom_readings")
      .select("title")
      .eq("id", sourceId)
      .eq("classroom_id", classroomId)
      .maybeSingle();
    return data?.title ?? null;
  }
  if (source === "assignment") {
    const { data } = await supabase
      .from("classroom_assignments")
      .select("title")
      .eq("id", sourceId)
      .eq("classroom_id", classroomId)
      .maybeSingle();
    return data?.title ?? null;
  }
  return null;
}

async function buildImportMetadata(supabase: SupabaseClient, source: string, sourceId: string) {
  if (source === "reading") {
    const [{ data: annotations }, { data: questions }, { data: reading }] = await Promise.all([
      supabase.from("reading_annotations").select("user_id,text,color,note,created_at").eq("reading_id", sourceId),
      supabase.from("reading_questions").select("id,sentence,question").eq("reading_id", sourceId),
      supabase.from("classroom_readings").select("class_summary,class_analysis_at").eq("id", sourceId).maybeSingle(),
    ]);
    const questionIds = (questions ?? []).map((item) => item.id);
    const { data: answers } = questionIds.length ? await supabase.from("reading_answers").select("user_id,question_id,answer,feedback").in("question_id", questionIds) : { data: [] };
    return { annotations: annotations ?? [], questions: questions ?? [], student_answers: answers ?? [], class_analysis: reading?.class_summary ?? null, imported_at: new Date().toISOString() };
  }
  if (source === "assignment") {
    const [{ data: submissions }, { data: assignment }] = await Promise.all([
      supabase.from("assignment_submissions").select("user_id,content,ocr_text,feedback,grade,submitted_at").eq("assignment_id", sourceId),
      supabase.from("classroom_assignments").select("class_summary,class_analysis_at").eq("id", sourceId).maybeSingle(),
    ]);
    return { student_answers: submissions ?? [], class_analysis: assignment?.class_summary ?? null, imported_at: new Date().toISOString() };
  }
  return {};
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
  if (role !== "teacher") {
    return NextResponse.json({ error: "只有教师能查看备课资料库" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("lesson_library")
    .select("*")
    .eq("user_id", auth.user.id)
    .eq("classroom_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
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
    return NextResponse.json({ error: "只有教师能添加备课素材" }, { status: 403 });
  }

  let body: { source?: unknown; source_id?: unknown; keep_notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const source = body.source;
  const keepNotes = body.keep_notes === true;
  const sourceId = typeof body.source_id === "string" ? body.source_id : "";
  if (
    source !== "material" &&
    source !== "reading" &&
    source !== "assignment"
  ) {
    return NextResponse.json({ error: "素材来源不正确" }, { status: 400 });
  }
  if (!sourceId) {
    return NextResponse.json({ error: "缺少素材 ID" }, { status: 400 });
  }

  const title = await resolveTitle(supabase, source, sourceId, id, auth.user.id);
  if (!title) {
    return NextResponse.json({ error: "素材不存在或无权访问" }, { status: 404 });
  }

  const metadata = keepNotes ? await buildImportMetadata(supabase, source, sourceId) : {};
  const { data, error } = await supabase
    .from("lesson_library")
    .upsert(
      {
        user_id: auth.user.id,
        classroom_id: id,
        source,
        source_id: sourceId,
        title,
        keep_notes: keepNotes,
        metadata,
      },
      { onConflict: "user_id,classroom_id,source,source_id" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id } = await params;
  const role = await myRole(supabase, auth.user.id, id);
  if (role !== "teacher") {
    return NextResponse.json({ error: "只有教师能清空备课资料库" }, { status: 403 });
  }

  const { error } = await supabase
    .from("lesson_library")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("classroom_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
