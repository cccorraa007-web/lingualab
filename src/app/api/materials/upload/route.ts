import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { extractDocxText, extractPdfText } from "@/lib/extract/text";
import { recognizeText } from "@/lib/aliyun/ocr";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SIZE = 15 * 1024 * 1024;
const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];

function fileExt(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
}

export async function POST(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();

  let file: File;
  try {
    const form = await request.formData();
    const value = form.get("file");
    if (!(value instanceof File)) {
      return NextResponse.json({ error: "缺少上传文件" }, { status: 400 });
    }
    file = value;
  } catch {
    return NextResponse.json({ error: "请使用文件上传" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "文件为空" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "文件过大，最大支持 15MB" }, { status: 400 });
  }

  const name = file.name || "未命名";
  const ext = fileExt(name);
  const mime = file.type || "";
  const buffer = Buffer.from(await file.arrayBuffer());

  let text = "";
  try {
    if (ext === "docx") {
      text = await extractDocxText(buffer);
    } else if (ext === "pdf") {
      text = await extractPdfText(buffer);
    } else if (mime.startsWith("image/") || IMAGE_EXTS.includes(ext)) {
      const result = await recognizeText(buffer.toString("base64"));
      text = result.text;
    } else {
      return NextResponse.json(
        { error: "不支持的文件类型，仅支持 Word(.docx)、PDF 和图片" },
        { status: 400 },
      );
    }
  } catch (e) {
    return NextResponse.json(
      { error: "文件识别失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }

  if (text.trim().length < 50) {
    return NextResponse.json(
      { error: "识别出的文字不足 50 个字符，请确认文件内容（扫描版 PDF 建议转为图片后上传）" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    text: text.trim(),
    title: name.replace(/\.[^.]+$/, ""),
  });
}
