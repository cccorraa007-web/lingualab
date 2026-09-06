import crypto from "crypto";

// 阿里云文字识别（OCR）骨架：通用文字识别。
// 默认按「OCR API」产品线（2021-07-07）的 RPC 风格实现；
// 若账号实际开通的是旧版「文字识别 ocr」（2019-12-30），
// 只需改 OCR_HOST / OCR_VERSION 与请求体字段，签名逻辑通用。
const OCR_HOST = "ocr-api.cn-hangzhou.aliyuncs.com";
const OCR_VERSION = "2021-07-07";
const OCR_ACTION = "RecognizeGeneral";

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
  params.Signature = rpcSignature("POST", params, accessKeySecret);

  const query = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join("&");
  const url = `https://${OCR_HOST}/?${query}`;

  // 通用文字识别以 Base64 提交图片；字段名（img/body/url）以控制台文档为准。
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ img: imageBase64 }),
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
