import { NextResponse } from "next/server";
import { compareAssignmentAnswers } from "@/lib/ai/batch-review";
import { extractDocumentText } from "@/lib/document-text";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { getClassroomRole } from "../../_auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const BUCKET = "assignment-files";
const MAX_FILES = 5;
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "answer";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const { id: classroomId, assignmentId } = await params;
  if (await getClassroomRole(auth.client, classroomId, auth.user.id) !== "teacher") return NextResponse.json({ error: "只有教师可以一键批改" }, { status: 403 });
  const { data: assignment } = await auth.client.from("classroom_assignments").select("id, teacher_answer_paths, teacher_answer_text").eq("id", assignmentId).eq("classroom_id", classroomId).maybeSingle();
  if (!assignment) return NextResponse.json({ error: "作业不存在" }, { status: 404 });

  const form = await request.formData();
  const files = form.getAll("teacher_answer_files").filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > MAX_FILES) return NextResponse.json({ error: "参考答案最多上传 5 个文件" }, { status: 400 });
  const paths: string[] = [];
  const referenceParts: string[] = [];
  try {
    if (files.length) {
      for (const file of files) {
        if (file.size > MAX_BYTES || !ALLOWED.has(file.type)) throw new Error(`文件 ${file.name} 的格式或大小不符合要求`);
        const path = `${assignmentId}/teacher_answer/${crypto.randomUUID()}-${safeName(file.name)}`;
        const { error } = await auth.client.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw new Error(error.message);
        paths.push(path);
        referenceParts.push(await extractDocumentText(file, file.name));
      }
    } else if (assignment.teacher_answer_text) referenceParts.push(assignment.teacher_answer_text);
    else return NextResponse.json({ error: "请上传参考答案" }, { status: 400 });

    const referenceText = referenceParts.filter(Boolean).join("\n\n");
    const { data: submissions, error: submissionError } = await auth.client.from("assignment_submissions").select("id, user_id, content, ocr_text, media_paths").eq("assignment_id", assignmentId);
    if (submissionError) throw new Error(submissionError.message);
    const students: { student_id: string; answer: string }[] = [];
    for (const submission of submissions ?? []) {
      const attachmentTexts: string[] = [];
      if (!submission.ocr_text) for (const path of (submission.media_paths ?? []) as string[]) {
        const { data } = await auth.client.storage.from(BUCKET).download(path);
        if (data) { const text = await extractDocumentText(data, path); if (text) attachmentTexts.push(text); }
      }
      students.push({ student_id: submission.user_id, answer: [submission.content, submission.ocr_text, ...attachmentTexts].filter(Boolean).join("\n\n") });
    }
    const results = await compareAssignmentAnswers(referenceText, students);
    const allPaths = [...((assignment.teacher_answer_paths ?? []) as string[]), ...paths];
    const { error: saveError } = await auth.client.from("classroom_assignments").update({ teacher_answer_paths: allPaths, teacher_answer_text: referenceText }).eq("id", assignmentId);
    if (saveError) throw new Error(saveError.message);
    return NextResponse.json({ results, submissions: (submissions ?? []).map((item) => ({ id: item.id, user_id: item.user_id })) });
  } catch (error) {
    for (const path of paths) await auth.client.storage.from(BUCKET).remove([path]);
    console.error("一键批改失败", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "一键批改失败" }, { status: 502 });
  }
}
