"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { topicName } from "@/lib/topics";
import { apiFetch } from "@/lib/auth";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface PolishItem {
  original: string;
  revised: string;
  reason: string;
  example: string;
  error_type: string;
  wrong: string;
  correct: string;
}

interface PromptCard {
  id?: string;
  content: string;
  zh: string | null;
  extra: {
    useful_chunks?: string[];
    sample_hint?: string;
  };
}

let ttsAudio: HTMLAudioElement | null = null;

async function speak(text: string) {
  try {
    if (ttsAudio) {
      ttsAudio.pause();
      ttsAudio = null;
    }
    const res = await apiFetch("/api/speech/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error("TTS 请求失败");
    const data = await res.json();
    const segments: string[] = data.segments ?? [];
    for (const segment of segments) {
      const audio = new Audio(segment);
      ttsAudio = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        void audio.play();
      });
    }
    ttsAudio = null;
  } catch (e) {
    console.error("TTS 播放失败", e);
  }
}

interface StreamingRecorder {
  stop: () => Promise<{ text: string; blob: Blob; silent: boolean }>;
}

const NLS_WS_URL = "wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1";
const SILENCE_THRESHOLD = 0.01;

function genId(): string {
  const u = crypto.randomUUID();
  return u.replace(/-/g, "");
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function floatToPcm16(samples: Float32Array): ArrayBuffer {
  const buf = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

async function getNlsCredentials(): Promise<{ token: string; appkey: string }> {
  const res = await apiFetch("/api/speech/token");
  const data = await res.json();
  if (!res.ok || !data.token || !data.appkey) {
    throw new Error(data.error || "获取语音凭证失败");
  }
  return { token: data.token, appkey: data.appkey };
}

async function startStreamingRecorder(): Promise<StreamingRecorder> {
  const { token, appkey } = await getNlsCredentials();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext({ sampleRate: 16000 });
  await ctx.resume();
  const sampleRate = ctx.sampleRate;
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(2048, 1, 1);
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const chunks: Float32Array[] = [];

  const taskId = genId();
  const context = {
    sdk: { name: "nls-web", version: "1.0.0", language: "javascript" },
  };
  const ws = new WebSocket(`${NLS_WS_URL}?token=${encodeURIComponent(token)}`);

  let finalText = "";
  let settleResult: ((t: string) => void) | null = null;
  const resultPromise = new Promise<string>((resolve) => {
    settleResult = resolve;
  });

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(String(ev.data));
      const name = msg?.header?.name;
      if (name === "RecognitionCompleted") {
        finalText = msg?.payload?.result ?? "";
        settleResult?.(finalText);
      } else if (name === "TaskFailed") {
        settleResult?.(finalText);
      }
    } catch {
      // 忽略无法解析的消息
    }
  };
  ws.onerror = () => settleResult?.(finalText);
  ws.onclose = () => settleResult?.(finalText);

  const sendStart = () => {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        header: {
          message_id: genId(),
          task_id: taskId,
          namespace: "SpeechRecognizer",
          name: "StartRecognition",
          appkey,
        },
        payload: {
          format: "pcm",
          sample_rate: sampleRate,
          enable_intermediate_result: false,
          enable_punctuation_prediction: true,
          enable_inverse_text_normalization: true,
        },
        context,
      }),
    );
  };
  ws.onopen = sendStart;
  if (ws.readyState === WebSocket.OPEN) sendStart();

  processor.onaudioprocess = (e) => {
    const data = new Float32Array(e.inputBuffer.getChannelData(0));
    chunks.push(data);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(floatToPcm16(data));
    }
  };
  source.connect(processor);
  processor.connect(gain);
  gain.connect(ctx.destination);

  return {
    stop: async () => {
      processor.onaudioprocess = null;
      try {
        source.disconnect();
        processor.disconnect();
        gain.disconnect();
      } catch {
        // 忽略关闭异常
      }
      stream.getTracks().forEach((t) => t.stop());

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            header: {
              message_id: genId(),
              task_id: taskId,
              namespace: "SpeechRecognizer",
              name: "StopRecognition",
              appkey,
            },
            context,
          }),
        );
      }
      const text = await Promise.race([
        resultPromise,
        new Promise<string>((resolve) => setTimeout(() => resolve(finalText), 10000)),
      ]);
      try {
        ws.close();
      } catch {
        // 忽略
      }
      try {
        await ctx.close();
      } catch {
        // 忽略
      }

      let total = 0;
      for (const c of chunks) total += c.length;
      const merged = new Float32Array(total);
      let off = 0;
      let peak = 0;
      for (const c of chunks) {
        merged.set(c, off);
        for (let i = 0; i < c.length; i++) {
          const a = Math.abs(c[i]);
          if (a > peak) peak = a;
        }
        off += c.length;
      }

      return {
        text: text.trim(),
        blob: encodeWav(merged, sampleRate),
        silent: peak < SILENCE_THRESHOLD,
      };
    },
  };
}

function FreePractice() {
  const [tags, setTags] = useState<string[]>([]);
  const [topic, setTopic] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [polish, setPolish] = useState<PolishItem[] | null>(null);
  const [selectedPolish, setSelectedPolish] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<PolishItem | null>(null);
  const [savingMistakes, setSavingMistakes] = useState(false);
  const [mistakeSaved, setMistakeSaved] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const mediaRecorderRef = useRef<StreamingRecorder | null>(null);

  useEffect(() => {
    apiFetch("/api/materials")
      .then((r) => r.json())
      .then((d) => {
        const set = new Set<string>();
        for (const m of d.materials ?? []) {
          for (const t of m.tags ?? []) set.add(t);
        }
        setTags([...set]);
      })
      .catch(() => {});
  }, []);

  async function start(t: string) {
    setTopic(t);
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/practice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t, history: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "失败");
      setMessages([{ role: "assistant", content: data.reply }]);
      speak(data.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function sendContent(content: string) {
    if (!content.trim() || loading) return;
    const userMsg: ChatMsg = { role: "user", content: content.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/practice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, history: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "失败");
      setMessages([...next, { role: "assistant", content: data.reply }]);
      speak(data.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function finish() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/practice/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "失败");
      setPolish(data.polish ?? []);
      setSelectedPolish(new Set());
      setMistakeSaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(i: number) {
    setSelectedPolish((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function startEdit(i: number) {
    if (!polish) return;
    setEditingIndex(i);
    setEditForm({ ...polish[i] });
  }

  function saveEdit() {
    if (editingIndex === null || !editForm || !polish) return;
    const next = [...polish];
    next[editingIndex] = editForm;
    setPolish(next);
    setEditingIndex(null);
    setEditForm(null);
  }

  async function saveMistakes() {
    const items = [...selectedPolish]
      .sort((a, b) => a - b)
      .map((i) => polish?.[i])
      .filter((p): p is PolishItem => Boolean(p))
      .map((p) => ({
        error_type: p.error_type,
        wrong: p.wrong,
        correct: p.correct,
        example: p.example || null,
        note: p.reason || null,
      }));
    if (items.length === 0) return;
    setSavingMistakes(true);
    setError("");
    try {
      const res = await apiFetch("/api/mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setMistakeSaved(true);
      setPolish((prev) =>
        prev ? prev.filter((_, i) => !selectedPolish.has(i)) : prev,
      );
      setSelectedPolish(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingMistakes(false);
    }
  }

  function toggleListening() {
    if (listening) {
      const rec = mediaRecorderRef.current;
      if (rec) {
        void rec.stop().then(({ text, silent }) => {
          setProcessing(false);
          if (silent) {
            setError("没有检测到声音，请检查麦克风是否开启、是否选对了输入设备");
          } else if (text) {
            void sendContent(text);
          } else {
            setError("没有识别到内容，请重新说一遍，或改用文字输入");
          }
        });
      }
      mediaRecorderRef.current = null;
      setListening(false);
      setProcessing(true);
      return;
    }
    void (async () => {
      try {
        const rec = await startStreamingRecorder();
        mediaRecorderRef.current = rec;
        setListening(true);
      } catch (e) {
        setError(
          "无法访问麦克风：" + (e instanceof Error ? e.message : String(e)),
        );
      }
    })();
  }

  if (!topic) {
    return (
      <div>
        <p className="text-zinc-600">选择一个话题，AI 将基于你的语料库内容用西语与你对话，由浅入深引导你开口。</p>
        {tags.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 p-10 text-center text-zinc-400">
            语料库还没有任何标签，请先去「语料库」导入文章
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap gap-2">
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => start(t)}
                className="rounded-full bg-orange-100 px-4 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-200"
              >
                {topicName(t)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (polish) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-900">对话总结</h2>
          <button
            onClick={() => {
              setPolish(null);
              setMessages([]);
              setTopic(null);
            }}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            再来一轮
          </button>
        </div>

        <section>
          <h3 className="text-sm font-semibold text-zinc-700">文字稿</h3>
          <div className="mt-2 space-y-2">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-xl p-3 ${m.role === "assistant" ? "bg-zinc-50" : "bg-orange-50/60"}`}
              >
                <span className="text-xs font-semibold text-zinc-400">
                  {m.role === "assistant" ? "考官" : "你"}
                </span>
                <p className="mt-1 text-sm text-zinc-700">{m.content}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-700">润色建议</h3>
            {polish.length > 0 && (
              <button
                onClick={saveMistakes}
                disabled={selectedPolish.size === 0 || savingMistakes}
                className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {savingMistakes ? "保存中…" : `加入错题本（${selectedPolish.size}）`}
              </button>
            )}
          </div>
          {mistakeSaved && (
            <p className="mt-2 text-xs text-emerald-600">
              已加入错题本，可在「错题本」页面查看
            </p>
          )}
          {polish.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">
              {mistakeSaved
                ? "润色建议已全部收集到错题本"
                : "没有发现明显问题，回答得很地道！"}
            </p>
          ) : (
            <div className="mt-2 space-y-3">
              {polish.map((p, i) => (
                <div key={i} className="rounded-xl border border-zinc-100 bg-white p-4">
                  {editingIndex === i && editForm ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          value={editForm.error_type}
                          onChange={(e) => setEditForm({ ...editForm, error_type: e.target.value })}
                          placeholder="错误类型"
                          className="w-1/3 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                        />
                        <input
                          value={editForm.wrong}
                          onChange={(e) => setEditForm({ ...editForm, wrong: e.target.value })}
                          placeholder="错误（如 como）"
                          className="w-1/3 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                        />
                        <input
                          value={editForm.correct}
                          onChange={(e) => setEditForm({ ...editForm, correct: e.target.value })}
                          placeholder="正确（如 en）"
                          className="w-1/3 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                        />
                      </div>
                      <textarea
                        value={editForm.example}
                        onChange={(e) => setEditForm({ ...editForm, example: e.target.value })}
                        placeholder="参考回答例句"
                        rows={2}
                        className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                      />
                      <input
                        value={editForm.reason}
                        onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                        placeholder="说明（可选）"
                        className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                      />
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700">保存</button>
                        <button onClick={() => setEditingIndex(null)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50">取消</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedPolish.has(i)}
                        onChange={() => toggleSelect(i)}
                        className="mt-1 h-4 w-4 accent-orange-600"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{p.error_type}</span>
                          {p.wrong && p.correct && (
                            <span className="text-sm">
                              <span className="text-red-600 line-through">{p.wrong}</span>
                              <span className="mx-1 text-zinc-400">→</span>
                              <span className="font-medium text-emerald-700">{p.correct}</span>
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-zinc-500 line-through">{p.original}</p>
                        <p className="mt-1 text-sm font-medium text-emerald-700">{p.revised}</p>
                        {p.reason && <p className="mt-1 text-xs text-zinc-400">{p.reason}</p>}
                        {p.example && (
                          <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2">
                            <span className="text-xs font-semibold text-blue-500">参考回答</span>
                            <p className="mt-1 text-sm text-zinc-700">{p.example}</p>
                          </div>
                        )}
                      </div>
                      <button onClick={() => startEdit(i)} className="shrink-0 text-xs text-zinc-400 hover:text-orange-600">编辑</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
          话题：{topicName(topic)}
        </span>
        <button
          onClick={finish}
          disabled={loading || messages.length < 2}
          className="rounded-lg border border-red-200 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          结束对话并查看总结
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-100 bg-white p-10 text-center">
        {loading || processing ? (
          <div>
            <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-orange-200" />
            <p className="mt-4 text-zinc-500">
              {processing ? "正在识别你的回答…" : "考官正在思考…"}
            </p>
          </div>
        ) : listening ? (
          <div>
            <div className="mx-auto h-10 w-10 animate-ping rounded-full bg-red-300" />
            <p className="mt-4 font-medium text-red-600">聆听中，请说西班牙语…</p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-zinc-400">
              第 {Math.ceil(messages.length / 2)} 轮
            </p>
            <p className="mt-2 text-zinc-600">
              点下方「语音回答」开始说，说完再点一次停止
            </p>
            <button
              onClick={() => lastAssistant && speak(lastAssistant.content)}
              className="mt-3 text-xs text-blue-600 hover:underline"
            >
              重听问题
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          onClick={toggleListening}
          disabled={loading || processing}
          className={`rounded-full px-10 py-4 text-base font-semibold text-white transition disabled:opacity-50 ${
            listening ? "bg-red-600" : "bg-orange-600 hover:bg-orange-700"
          }`}
        >
          {listening ? "停止并发送" : "语音回答"}
        </button>

        <button
          onClick={() => setShowTextInput(!showTextInput)}
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          {showTextInput ? "收起文字输入" : "语音识别不可用？改用文字输入"}
        </button>

        {showTextInput && (
          <div className="flex w-full gap-2">
            <input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendContent(textInput);
                  setTextInput("");
                }
              }}
              placeholder="用西班牙语输入…（Enter 发送）"
              className="flex-1 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm outline-none focus:border-orange-400"
            />
            <button
              onClick={() => {
                sendContent(textInput);
                setTextInput("");
              }}
              disabled={loading || !textInput.trim()}
              className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              发送
            </button>
          </div>
        )}

        <p className="text-xs text-zinc-400">
          对话过程中不显示文字，结束后统一查看文字稿
        </p>
      </div>
    </div>
  );
}

const EXAM_TYPES = [
  { key: "t1", label: "简单问答", seconds: 120 },
  { key: "t3", label: "情景对话", seconds: 120 },
  { key: "t5", label: "观点表达", seconds: 180 },
];

function ExamPractice() {
  const [question, setQuestion] = useState<PromptCard | null>(null);
  const [phase, setPhase] = useState<"idle" | "prepare" | "answer" | "done">(
    "idle",
  );
  const [prepareSeconds, setPrepareSeconds] = useState(120);
  const [answerSeconds, setAnswerSeconds] = useState(120);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [polish, setPolish] = useState<PolishItem[] | null>(null);
  const [polishing, setPolishing] = useState(false);
  const [error, setError] = useState("");
  const recorderRef = useRef<StreamingRecorder | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const rec = await startStreamingRecorder();
      recorderRef.current = rec;
    } catch (e) {
      setError("无法访问麦克风：" + (e instanceof Error ? e.message : String(e)));
    }
  }, []);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec) {
      void rec.stop().then(({ text, blob, silent }) => {
        audioBlobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        setTranscript(text);
        if (silent) {
          setError("没有检测到声音，请检查麦克风是否开启、是否选对了输入设备");
        }
      });
      recorderRef.current = null;
    }
  }, []);

  async function drawQuestion(type: string, seconds: number) {
    setError("");
    setAudioUrl(null);
    setTranscript("");
    setPolish(null);
    audioBlobRef.current = null;
    try {
      const res = await apiFetch("/api/practice/exam-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "抽题失败");
      setQuestion(data.question);
      setPrepareSeconds(120);
      setAnswerSeconds(seconds);
      setPhase("prepare");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    if (phase !== "prepare" && phase !== "answer") return;
    const timer = setInterval(() => {
      if (phase === "prepare") {
        if (prepareSeconds <= 1) {
          setPhase("answer");
          void startRecording();
        } else {
          setPrepareSeconds((s) => s - 1);
        }
      } else {
        if (answerSeconds <= 1) {
          stopRecording();
          setPhase("done");
        } else {
          setAnswerSeconds((s) => s - 1);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, prepareSeconds, answerSeconds, startRecording, stopRecording]);

  function reset() {
    setPhase("idle");
    setQuestion(null);
    setAudioUrl(null);
    setTranscript("");
    setPolish(null);
    audioBlobRef.current = null;
  }

  async function generatePolish() {
    const text = transcript.trim();
    if (!text) {
      setError("没有识别到内容，无法生成润色建议");
      return;
    }
    setPolishing(true);
    setError("");
    try {
      const polishRes = await apiFetch("/api/practice/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: [{ role: "user", content: text }] }),
      });
      const polishData = await polishRes.json();
      if (!polishRes.ok) throw new Error(polishData.error || "润色失败");
      setPolish(polishData.polish ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPolishing(false);
    }
  }

  function fmt(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  if (phase === "idle") {
    return (
      <div>
        <p className="text-zinc-600">
          参考 SIELE 口语考试，从语料库的「口语」卡片随机抽题，2 分钟准备，限时作答并全程录音。
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {EXAM_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => drawQuestion(t.key, t.seconds)}
              className="rounded-xl border border-zinc-200 bg-white p-5 text-left transition hover:border-orange-300 hover:shadow-md"
            >
              <p className="font-semibold text-zinc-900">{t.label}</p>
              <p className="mt-1 text-xs text-zinc-400">回答 {t.seconds / 60} 分钟</p>
            </button>
          ))}
        </div>
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <p className="text-xs font-semibold text-zinc-400">题目</p>
        <p className="mt-2 text-lg font-medium text-zinc-900">
          {question?.content}
        </p>
        {question?.zh && (
          <p className="mt-1 text-sm text-zinc-500">{question.zh}</p>
        )}
        {question?.extra?.sample_hint && (
          <p className="mt-2 text-xs text-zinc-400">
            思路：{question.extra.sample_hint}
          </p>
        )}
        {question?.extra?.useful_chunks &&
          question.extra.useful_chunks.length > 0 && (
            <p className="mt-1 text-xs text-zinc-400">
              可用表达：{question.extra.useful_chunks.join(" · ")}
            </p>
          )}
      </div>

      <div className="mt-4 flex items-center gap-4">
        {phase === "prepare" && (
          <>
            <div className="text-center">
              <p className="text-3xl font-bold tabular-nums text-zinc-900">
                {fmt(prepareSeconds)}
              </p>
              <p className="text-xs text-zinc-400">准备中</p>
            </div>
            <button
              onClick={() => {
                setPhase("answer");
                void startRecording();
              }}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              直接开始回答
            </button>
          </>
        )}
        {phase === "answer" && (
          <>
            <div className="text-center">
              <p className="text-3xl font-bold tabular-nums text-emerald-600">
                {fmt(answerSeconds)}
              </p>
              <p className="text-xs text-zinc-400">回答中（录音中…）</p>
            </div>
            <button
              onClick={() => {
                stopRecording();
                setPhase("done");
              }}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              结束回答
            </button>
          </>
        )}
        {phase === "done" && (
          <>
            <button
              onClick={generatePolish}
              disabled={polishing}
              className="rounded-lg border border-orange-300 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50"
            >
              {polishing ? "生成中…" : "生成润色建议"}
            </button>
            <button
              onClick={reset}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              重新抽题
            </button>
          </>
        )}
      </div>

      {phase === "done" && audioUrl && (
        <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
          <p className="text-sm font-semibold text-zinc-700">你的录音（自查回放）</p>
          <audio controls src={audioUrl} className="mt-2 w-full" />
        </div>
      )}

      {phase === "done" && transcript && (
        <div className="mt-4 rounded-xl border border-zinc-100 bg-white p-4">
          <p className="text-sm font-semibold text-zinc-700">文字稿</p>
          <p className="mt-2 text-sm leading-7 text-zinc-700">{transcript}</p>
        </div>
      )}

      {phase === "done" && polish && (
        <div className="mt-4 rounded-xl border border-zinc-100 bg-white p-4">
          <p className="text-sm font-semibold text-zinc-700">润色建议</p>
          {polish.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">
              没有发现明显问题，回答得很地道！
            </p>
          ) : (
            <div className="mt-2 space-y-3">
              {polish.map((p, i) => (
                <div key={i} className="rounded-lg bg-zinc-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                      {p.error_type}
                    </span>
                    {p.wrong && p.correct && (
                      <span className="text-sm">
                        <span className="text-red-600 line-through">{p.wrong}</span>
                        <span className="mx-1 text-zinc-400">→</span>
                        <span className="font-medium text-emerald-700">{p.correct}</span>
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-zinc-500 line-through">{p.original}</p>
                  <p className="mt-1 text-sm font-medium text-emerald-700">{p.revised}</p>
                  {p.reason && <p className="mt-1 text-xs text-zinc-400">{p.reason}</p>}
                  {p.example && (
                    <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2">
                      <span className="text-xs font-semibold text-blue-500">参考回答</span>
                      <p className="mt-1 text-sm text-zinc-700">{p.example}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

export default function PracticePage() {
  const [mode, setMode] = useState<"free" | "exam">("free");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        口语练习
      </h1>

      <div className="mt-4 flex gap-2 border-b border-zinc-100 pb-3">
        <button
          onClick={() => setMode("free")}
          className={`rounded-full px-5 py-2 text-sm font-medium transition ${
            mode === "free"
              ? "bg-orange-600 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          自由练习
        </button>
        <button
          onClick={() => setMode("exam")}
          className={`rounded-full px-5 py-2 text-sm font-medium transition ${
            mode === "exam"
              ? "bg-orange-600 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          考题模式
        </button>
      </div>

      <div className="mt-6">
        {mode === "free" ? <FreePractice /> : <ExamPractice />}
      </div>
    </div>
  );
}
