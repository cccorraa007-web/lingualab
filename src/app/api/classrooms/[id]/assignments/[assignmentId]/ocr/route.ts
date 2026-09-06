import { NextResponse } from "next/server";
import { recognizeText } from "@/lib/aliyun/ocr";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { getClassroomRole } from "../../_auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const BUCKET = "assignment-files";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const { id: classroomId, assignmentId } = await params;
  if (await getClassroomRole(auth.client, classroomId, auth.user.id) !== "teacher") {
    return NextResponse.json({ error: "只有教师可以提取图片文字" }, { status: 403 });
  }
  let submissionId = "";
  try {
    const body = (await request.json()) as { submission_id?: unknown };
    submissionId = typeof body.submission_id === "string" ? body.submission_id : "";
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const { data: assignment } = await auth.client.from("classroom_assignments").select("id").eq("id", assignmentId).eq("classroom_id", classroomId).maybeSingle();
  if (!assignment) return NextResponse.json({ error: "作业不存在" }, { status: 404 });
  const { data: submission } = await auth.client.from("assignment_submissions").select("id, media_paths").eq("id", submissionId).eq("assignment_id", assignmentId).maybeSingle();
  if (!submission) return NextResponse.json({ error: "提交记录不存在" }, { status: 404 });

  const texts: string[] = [];
  let imageCount = 0;
  try {
    for (const path of (submission.media_paths ?? []) as string[]) {
      const { data, error } = await auth.client.storage.from(BUCKET).download(path);
      if (error || !data) throw new Error(error?.message || "附件下载失败");
      if (!data.type.startsWith("image/")) continue;
      imageCount += 1;
      const result = await recognizeText(Buffer.from(await data.arrayBuffer()).toString("base64"));
      if (result.text.trim()) texts.push(result.text.trim());
    }
    if (imageCount === 0) return NextResponse.json({ error: "这份提交没有图片附件" }, { status: 400 });
    const ocrText = texts.join("\n\n");
    const { error } = await auth.client.from("assignment_submissions").update({ ocr_text: ocrText }).eq("id", submissionId).eq("assignment_id", assignmentId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ocr_text: ocrText });
  } catch (error) {
    console.error("作业图片 OCR 失败", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "图片文字提取失败" }, { status: 502 });
  }
}
