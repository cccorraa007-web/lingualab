import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import {
  generateLessonContent,
  type QuestionType,
} from "@/lib/lesson/content";
import { buildDocx, buildPptx } from "@/lib/lesson/build";
import { detectSupportedLanguage } from "@/lib/language";

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

interface SelectedItem {
  source: "material" | "reading" | "assignment";
  id: string;
}

async function fetchTexts(
  supabase: SupabaseClient,
  classroomId: string,
  userId: string,
  items: SelectedItem[],
): Promise<{ title: string; text: string }[]> {
  const materialIds = items.filter((i) => i.source === "material").map((i) => i.id);
  const readingIds = items.filter((i) => i.source === "reading").map((i) => i.id);
  const assignmentIds = items.filter((i) => i.source === "assignment").map((i) => i.id);

  const results: { title: string; text: string }[] = [];

  if (materialIds.length > 0) {
    const { data } = await supabase
      .from("materials")
      .select("id, title, raw_text")
      .in("id", materialIds)
      .eq("user_id", userId);
    for (const m of data ?? []) {
      results.push({ title: m.title ?? "语料库素材", text: m.raw_text ?? "" });
    }
  }

  if (readingIds.length > 0) {
    const { data } = await supabase
      .from("classroom_readings")
      .select("id, title, raw_text")
      .in("id", readingIds)
      .eq("classroom_id", classroomId);
    for (const r of data ?? []) {
      results.push({ title: r.title, text: r.raw_text ?? "" });
    }
  }

  if (assignmentIds.length > 0) {
    const { data } = await supabase
      .from("classroom_assignments")
      .select("id, title, content, class_summary")
      .in("id", assignmentIds)
      .eq("classroom_id", classroomId);
    const [{ data: submissions }, { data: recipients }] = await Promise.all([
      supabase.from("assignment_submissions").select("assignment_id, user_id, content, ocr_text, feedback, grade").in("assignment_id", assignmentIds),
      supabase.from("assignment_recipients").select("assignment_id, user_id, email").in("assignment_id", assignmentIds),
    ]);
    for (const a of data ?? []) {
      const emailByUser = new Map((recipients ?? []).filter((r) => r.assignment_id === a.id).map((r) => [r.user_id, r.email || r.user_id]));
      const latestSubmissions = (submissions ?? []).filter((s) => s.assignment_id === a.id).map((s) => `【${emailByUser.get(s.user_id) ?? s.user_id}】\n提交：${[s.content, s.ocr_text].filter(Boolean).join("\n") || "无文字"}\n等级：${s.grade || "未评分"}\n反馈：${s.feedback || "无"}`).join("\n\n");
      results.push({ title: a.title, text: `作业要求：\n${a.content ?? ""}\n\n最新学生提交与批改：\n${latestSubmissions || "暂无提交"}\n\n最新班级作答分析：\n${a.class_summary || "尚未生成"}` });
    }
  }

  return results;
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
    return NextResponse.json({ error: "只有教师能生成课件" }, { status: 403 });
  }

  let body: {
    items?: { source?: string; id?: string }[];
    format?: string;
    questionTypes?: string[];
    questionCount?: number;
    extra?: string;
    wordExplanation?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const items: SelectedItem[] = (Array.isArray(body.items) ? body.items : [])
    .filter(
      (i): i is SelectedItem =>
        Boolean(i) &&
        typeof i.id === "string" &&
        (i.source === "material" ||
          i.source === "reading" ||
          i.source === "assignment"),
    )
    .slice(0, 20);

  if (items.length === 0) {
    return NextResponse.json({ error: "请至少勾选一个素材" }, { status: 400 });
  }

  const format = body.format === "docx" ? "docx" : "pptx";
  const questionTypes = (Array.isArray(body.questionTypes)
    ? body.questionTypes
    : ["blank", "choice"]
  )
    .filter((t): t is QuestionType => (VALID_TYPES as string[]).includes(t))
    .slice(0, 4);
  const questionCount = Math.min(
    50,
    Math.max(1, Number(body.questionCount) || 10),
  );
  const extra = typeof body.extra === "string" ? body.extra.trim() : undefined;
  const wordExplanation = body.wordExplanation === true;

  const texts = await fetchTexts(supabase, id, auth.user.id, items);
  if (texts.length === 0) {
    return NextResponse.json({ error: "没有找到可用的素材内容" }, { status: 400 });
  }

  const combinedTitle = texts.map((t) => t.title).filter(Boolean).join(" · ") || "备课课件";
  const combinedText = texts
    .map((t) => `【${t.title}】\n${t.text}`)
    .join("\n\n");

  const { data: classroom } = await supabase
    .from("classrooms")
    .select("lang")
    .eq("id", id)
    .maybeSingle();
  const lang =
    classroom?.lang === "en"
      ? "en"
      : classroom?.lang === "es"
        ? "es"
        : detectSupportedLanguage(combinedText) === "en"
          ? "en"
          : "es";

  let lesson;
  try {
    lesson = await generateLessonContent({
      title: combinedTitle,
      text: combinedText,
      annotations: [],
      questions: [],
      lang: lang as "es" | "en",
      requirement: {
        format,
        questionTypes,
        questionCount,
        extra,
        wordExplanation,
      },
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

  const filename = `${sanitizeFilename(combinedTitle)}-${Date.now()}.${ext}`;
  const dataUrl = `data:${mime};base64,${fileBuffer.toString("base64")}`;

  return NextResponse.json({ filename, mime, dataUrl });
}
