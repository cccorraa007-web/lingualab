import { recognizeText } from "@/lib/aliyun/ocr";

const MIN_PAGE_TEXT = 20;
const MAX_PDF_PAGES = 30;

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const [{ PDFiumLibrary }, { default: sharp }] = await Promise.all([
    import("@hyzyla/pdfium"),
    import("sharp"),
  ]);
  const library = await PDFiumLibrary.init();
  const document = await library.loadDocument(buffer);
  const pageCount = document.getPageCount();
  if (pageCount > MAX_PDF_PAGES) {
    document.destroy(); library.destroy();
    throw new Error(`PDF 最多支持 ${MAX_PDF_PAGES} 页，当前文件有 ${pageCount} 页`);
  }

  const pages: string[] = [];
  try {
    for (const page of document.pages()) {
      const text = page.getText().replace(/\s+/g, " ").trim();
      if (text.length >= MIN_PAGE_TEXT) {
        pages.push(text);
        continue;
      }
      const rendered = await page.render({
        scale: 2,
        render: async ({ data, width, height }) => sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer(),
      });
      const ocr = await recognizeText(Buffer.from(rendered.data).toString("base64"));
      if (ocr.text.trim()) pages.push(ocr.text.trim());
    }
  } finally {
    document.destroy();
    library.destroy();
  }
  return pages.join("\n\n");
}

export async function extractDocumentText(blob: Blob, fileName = ""): Promise<string> {
  const type = blob.type.toLowerCase();
  const ext = extension(fileName);
  const buffer = Buffer.from(await blob.arrayBuffer());
  if (type.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) return (await recognizeText(buffer.toString("base64"))).text.trim();
  if (type === "application/pdf" || ext === ".pdf") return extractPdf(buffer);
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || ext === ".docx") {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer })).value.trim();
  }
  throw new Error(`不支持解析文件 ${fileName || type || "未知格式"}`);
}
