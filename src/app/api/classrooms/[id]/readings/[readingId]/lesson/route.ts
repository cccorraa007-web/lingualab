import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import {
  generateLessonContent,
  type QuestionType,
} from "@/lib/lesson/content";
import { buildDocx, buildPptx } from "@/lib/lesson/build";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VALID_TYPES: QuestionType[] = ["blank", "choice", "truefalse", "qa"];

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

function sanitizeFilename(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return cleaned || "课件";
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
    return NextResponse.json({ error: "只有教师能使用辅助备课" }, { status: 403 });
  }

  const { data: reading, error: rErr } = await supabase
    .from("classroom_readings")
    .select("title, raw_text")
    .eq("id", readingId)
    .eq("classroom_id", id)
    .single();
  if (rErr || !reading) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  const { data: annotations } = await supabase
    .from("reading_annotations")
    .select("text, note")
    .eq("reading_id", readingId)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true });

  const { data: questions } = await supabase
    .from("reading_questions")
    .select("sentence, question")
    .eq("reading_id", readingId)
    .order("created_at", { ascending: true });

  let body: {
    format?: string;
    questionTypes?: string[];
    questionCount?: number;
    extra?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const format = body.format === "docx" ? "docx" : "pptx";
  const questionTypes = (Array.isArray(body.questionTypes)
    ? body.questionTypes
    : ["blank", "choice"]
  )
    .filter((t): t is QuestionType =>
      (VALID_TYPES as string[]).includes(t),
    )
    .slice(0, 4);
  const questionCount = Math.min(
    50,
    Math.max(1, Number(body.questionCount) || 10),
  );
  const extra =
    typeof body.extra === "string" ? body.extra.trim() : undefined;

  let lesson;
  try {
    lesson = await generateLessonContent({
      title: reading.title,
      text: reading.raw_text,
      annotations: (annotations ?? []).map((a) => ({
        text: a.text,
        note: a.note,
      })),
      questions: (questions ?? []).map((q) => ({
        sentence: q.sentence,
        question: q.question,
      })),
      lang: auth.user.lang,
      requirement: { format, questionTypes, questionCount, extra },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "AI 生成失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }

  let fileBuffer: Buffer;
  let mime: string;
  let ext: string;
  try {
    if (format === "docx") {
      fileBuffer = await buildDocx(lesson);
      mime =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      ext = "docx";
    } else {
      fileBuffer = await buildPptx(lesson);
      mime =
        "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      ext = "pptx";
    }
  } catch (e) {
    return NextResponse.json(
      { error: "文件生成失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }

  const filename = `${sanitizeFilename(lesson.title)}-${Date.now()}.${ext}`;
  const dataUrl = `data:${mime};base64,${fileBuffer.toString("base64")}`;

  return NextResponse.json({ filename, mime, dataUrl });
}
