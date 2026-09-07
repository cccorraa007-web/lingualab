import crypto from "crypto";

// 阿里云文字识别（OCR）：通用多语言识别。
// 产品线「OCR API」（2021-07-07），RPC 风格签名。
// 语言支持：lading（拉丁，含西班牙语）、eng（英语）、chn（中文），接口内部自动分类判定。
const OCR_HOST = "ocr-api.cn-hangzhou.aliyuncs.com";
const OCR_VERSION = "2021-07-07";
const OCR_ACTION = "RecognizeMultiLanguage";
const OCR_LANGUAGES = ["lading", "eng", "chn"];

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

function rpcSignature(
  method: string,
  params: Record<string, string>,
  secret: string,
): string {
  const sortedKeys = Object.keys(params).sort();
  const canonicalized = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join("&");
  const stringToSign = `${method}&${percentEncode("/")}&${percentEncode(canonicalized)}`;
  const hmac = crypto.createHmac("sha1", `${secret}&`);
  hmac.update(stringToSign);
  return hmac.digest("base64");
}

export interface RecognizeTextResult {
  text: string;
  content: unknown;
}

// imageBase64：纯 Base64 字符串（不含 data:image/...;base64, 前缀）
export async function recognizeText(
  imageBase64: string,
): Promise<RecognizeTextResult> {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("缺少阿里云 AccessKey 环境变量");
  }
  if (!imageBase64) {
    throw new Error("缺少图片数据");
  }

  // 参与签名的参数：系统参数 + Languages（数组用 Languages.1/Languages.2 展开）。
  // 注意：body（图片）作为原始请求体发送，不参与签名。
  const params: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Action: OCR_ACTION,
    Format: "JSON",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: "1.0",
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: OCR_VERSION,
  };
  OCR_LANGUAGES.forEach((lang, i) => {
    params[`Languages.${i + 1}`] = lang;
  });
  params.Signature = rpcSignature("POST", params, accessKeySecret);

  // 全部签名参数（系统 + Languages.N + Signature）放 URL query；图片二进制作为原始请求体发送。
  const query = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join("&");
  const url = `https://${OCR_HOST}/?${query}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: Buffer.from(imageBase64, "base64"),
  });
  const data = await res.json();

  if (data?.Code && data?.Message) {
    throw new Error(`OCR 失败: ${data.Code} ${data.Message}`);
  }

  const raw = typeof data?.Data === "string" ? JSON.parse(data.Data) : data?.Data ?? {};
  let text = raw?.content ?? raw?.text ?? "";
  if (!text && Array.isArray(raw?.prun_words)) {
    text = raw.prun_words
      .map((w: { word?: string }) => w?.word ?? "")
      .filter(Boolean)
      .join("\n");
  }

  return { text, content: raw };
}
