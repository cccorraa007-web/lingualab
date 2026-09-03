import crypto from "crypto";

const REGION = "cn-shanghai";
const NLS_GATEWAY_HOST = `nls-gateway.${REGION}.aliyuncs.com`;
const NLS_META_HOST = `nls-meta.${REGION}.aliyuncs.com`;

let cachedToken: string | null = null;
let cachedTokenExpire = 0;

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

function rpcSignature(params: Record<string, string>, secret: string): string {
  const sortedKeys = Object.keys(params).sort();
  const canonicalized = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join("&");
  const stringToSign = `GET&${percentEncode("/")}&${percentEncode(canonicalized)}`;
  const hmac = crypto.createHmac("sha1", `${secret}&`);
  hmac.update(stringToSign);
  return hmac.digest("base64");
}

async function fetchToken(): Promise<string> {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("缺少阿里云 AccessKey 环境变量");
  }

  const params: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Action: "CreateToken",
    Format: "JSON",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: "1.0",
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2019-02-28",
  };
  params.Signature = rpcSignature(params, accessKeySecret);

  const query = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join("&");
  const url = `https://${NLS_META_HOST}/?${query}`;

  const res = await fetch(url);
  const data = await res.json();
  const token: string | undefined = data?.Token?.Id;
  if (!token) {
    throw new Error("获取阿里云 Token 失败: " + JSON.stringify(data));
  }
  return token;
}

export async function getNlsToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedTokenExpire) {
    return cachedToken;
  }
  const token = await fetchToken();
  cachedToken = token;
  cachedTokenExpire = Date.now() + 20 * 60 * 60 * 1000;
  return token;
}

function getToken(): Promise<string> {
  return getNlsToken();
}

export function getAppKey(): string {
  const key = process.env.ALIYUN_APP_KEY;
  if (!key) {
    throw new Error("缺少 ALIYUN_APP_KEY 环境变量");
  }
  return key;
}

function appKey(): string {
  return getAppKey();
}

const TTS_MAX_CHARS = 250;

function splitText(text: string, maxLen: number): string[] {
  const sentences = text.split(/(?<=[.!?¡¿。！？])\s+/);
  const segments: string[] = [];
  let current = "";
  for (const s of sentences) {
    const next = current ? `${current} ${s}` : s;
    if (next.length > maxLen && current) {
      segments.push(current);
      current = s;
    } else {
      current = next;
    }
  }
  if (current.trim()) segments.push(current.trim());
  return segments;
}

async function synthesizeOne(text: string): Promise<ArrayBuffer> {
  const token = await getToken();
  const params = new URLSearchParams({
    appkey: appKey(),
    token,
    text,
    format: "mp3",
    sample_rate: "16000",
    voice: process.env.ALIYUN_TTS_VOICE || "Camila",
  });
  const url = `https://${NLS_GATEWAY_HOST}/stream/v1/tts?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("TTS 合成失败: " + (await res.text()));
  }
  return res.arrayBuffer();
}

function cleanTextForTTS(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`{1,3}(.+?)`{1,3}/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/[\[\](){}<>]/g, "")
    .replace(/[*_~#`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function synthesizeSpeech(text: string): Promise<ArrayBuffer[]> {
  const cleaned = cleanTextForTTS(text);
  const segments = splitText(cleaned, TTS_MAX_CHARS);
  const buffers: ArrayBuffer[] = [];
  for (const seg of segments) {
    buffers.push(await synthesizeOne(seg));
  }
  return buffers;
}

export async function recognizeSpeech(
  audioData: ArrayBuffer,
  format = "wav",
  sampleRate = 16000,
): Promise<string> {
  const token = await getToken();
  const params = new URLSearchParams({
    appkey: appKey(),
    format,
    sample_rate: String(sampleRate),
    enable_punctuation_prediction: "true",
    enable_inverse_text_normalization: "true",
  });
  const url = `https://${NLS_GATEWAY_HOST}/stream/v1/asr?${params.toString()}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-NLS-Token": token,
      "Content-Type": "application/octet-stream",
    },
    body: audioData,
  });
  if (!res.ok) {
    throw new Error("ASR 识别失败: " + (await res.text()));
  }
  const data = await res.json();
  return data?.result ?? "";
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 3,
): Promise<Response> {
  let lastErr: Error | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status < 500) return res;
      lastErr = new Error(`HTTP ${res.status}: ${await res.text()}`);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr ?? new Error("请求失败");
}

export async function transcribeSpeech(
  audioData: ArrayBuffer,
  format = "wav",
  sampleRate = 16000,
): Promise<string> {
  const token = await getToken();
  const base = `https://${NLS_GATEWAY_HOST}/stream/v1/filetrans`;

  const submitParams = new URLSearchParams({
    appkey: appKey(),
    format,
    sample_rate: String(sampleRate),
    enable_punctuation_prediction: "true",
    enable_inverse_text_normalization: "true",
  });

  const submitRes = await fetchWithRetry(`${base}?${submitParams.toString()}`, {
    method: "POST",
    headers: {
      "X-NLS-Token": token,
      "Content-Type": "application/octet-stream",
    },
    body: audioData,
  });
  const submitData = await submitRes.json();
  const taskId: string | undefined = submitData?.task_id;
  if (!taskId) {
    throw new Error("录音文件识别未返回任务 ID: " + JSON.stringify(submitData));
  }

  const pollParams = new URLSearchParams({ appkey: appKey(), task_id: taskId });
  const pollUrl = `${base}?${pollParams.toString()}`;

  for (let i = 0; i < 60; i++) {
    const pollRes = await fetchWithRetry(pollUrl, {
      headers: { "X-NLS-Token": token },
    });
    const data = await pollRes.json();
    const status = data?.status as number | undefined;
    if (status === 21050000) {
      return typeof data?.result === "string" ? data.result : "";
    }
    if (typeof data?.result === "string" && data.result.trim()) {
      return data.result;
    }
    if (status && status >= 40000000) {
      throw new Error("录音文件识别失败: " + JSON.stringify(data));
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("录音文件识别超时");
}
