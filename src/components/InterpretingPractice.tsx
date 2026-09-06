"use client";

import { useRef, useState } from "react";
import { apiFetch } from "@/lib/auth";
import { detectLanguage, langMeta, type TargetLang } from "@/lib/language";
import type { MistakePracticeMode } from "@/lib/ai/writing";

interface Mistake {
  id: string;
  error_type: string;
  wrong: string;
  correct: string;
}

interface PracticeState {
  mistake: Mistake;
  prompt: string;
}

interface AnswerResult {
  correct: boolean;
  feedback: string;
  removed: boolean;
  streak: number;
}

export default function InterpretingPractice({
  onBack,
}: {
  onBack: () => void;
}) {
  const [lang, setLang] = useState<TargetLang>("es");
  const [practiceMode, setPracticeMode] = useState<MistakePracticeMode | null>(null);
  const [state, setState] = useState<PracticeState | null>(null);
  const [done, setDone] = useState(false);
  const [doneReason, setDoneReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  function next(selectedMode: MistakePracticeMode | null = practiceMode) {
    if (!selectedMode) return;
    setLoading(true);
    setResult(null);
    setAnswer("");
    setError("");
    apiFetch(`/api/mistakes/practice?mode=${selectedMode}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "出题失败");
        return data;
      })
      .then((d) => {
        if (d.done) {
          setDone(true);
          setDoneReason(d.reason);
          setState(null);
        } else {
          setDone(false);
          setState({ mistake: d.mistake, prompt: d.prompt });
          setLang(d.lang ?? detectLanguage(d.mistake?.correct ?? ""));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }

  async function recognizeAndSend(blob: Blob) {
    try {
      const res = await apiFetch("/api/speech/asr?format=opus", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: blob,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "识别失败");
      const text = (data.text ?? "").trim();
      if (text) {
        await submit(text);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function toggleListening() {
    if (listening) {
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
      setListening(false);
      return;
    }
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const rec = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => chunks.push(e.data);
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: "audio/webm" });
          void recognizeAndSend(blob);
        };
        rec.start();
        mediaRecorderRef.current = rec;
        setListening(true);
      } catch (e) {
        setError(
          "无法访问麦克风：" + (e instanceof Error ? e.message : String(e)),
        );
      }
    })();
  }

  async function submit(text: string) {
    if (!text.trim() || !state) return;
    setLoading(true);
    setAnswer(text);
    setError("");
    try {
      const res = await apiFetch("/api/mistakes/practice/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: state.mistake.id,
          answer: text.trim(),
          prompt: state.prompt,
          mode: practiceMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "评价失败");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function chooseMode(selectedMode: MistakePracticeMode) {
    setPracticeMode(selectedMode);
    setDone(false);
    setDoneReason("");
    setState(null);
    setResult(null);
    next(selectedMode);
  }

  if (!practiceMode) {
    return (
      <div>
        <button onClick={onBack} className="text-sm text-zinc-500 hover:text-orange-600">
          ← 返回错题本
        </button>
        <div className="mt-3">
          <h2 className="text-2xl font-bold text-zinc-900">选择练习方式</h2>
          <p className="mt-2 text-sm text-zinc-500">
            两种模式都使用你的真实错题生成练习，可以随时返回重新选择。
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => chooseMode("interpret")}
            className="rounded-2xl border border-orange-200 bg-orange-50/50 p-6 text-left transition hover:border-orange-400 hover:bg-orange-50"
          >
            <span className="text-xl font-bold text-zinc-900">口译</span>
            <span className="mt-2 block text-sm leading-6 text-zinc-600">
              中文短句，使用语音或文字即时回答，重点练习表达是否自然、准确。
            </span>
          </button>
          <button
            type="button"
            onClick={() => chooseMode("translate")}
            className="rounded-2xl border border-zinc-200 bg-white p-6 text-left transition hover:border-orange-400 hover:bg-orange-50/40"
          >
            <span className="text-xl font-bold text-zinc-900">笔译</span>
            <span className="mt-2 block text-sm leading-6 text-zinc-600">
              更长、更复杂的中文句子，重点评价句式选择、词性和用词准确性。
            </span>
          </button>
        </div>
      </div>
    );
  }

  const isInterpreting = practiceMode === "interpret";
  const modeName = isInterpreting ? "口译" : "笔译";

  return (
    <div>
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="text-sm text-zinc-500 hover:text-orange-600">
          ← 返回错题本
        </button>
        <button
          onClick={() => setPracticeMode(null)}
          className="text-sm text-zinc-500 hover:text-orange-600"
        >
          切换模式
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-900">{modeName}练习</h2>
        <span className="text-xs text-zinc-400">
          把中文{modeName}成{langMeta(lang).short}，巩固正确表达
        </span>
      </div>

      {done ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-200 p-12 text-center">
          <p className="text-lg font-medium text-zinc-700">
            {doneReason === "empty"
              ? "错题本还没有内容"
              : "今天的错题都复习完啦！"}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            {doneReason === "empty"
              ? "先从口语或写作润色中收集一些错题再来巩固"
              : "可以返回错题本，或切换另一种练习模式"}
          </p>
          <button
            onClick={onBack}
            className="mt-6 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
          >
            返回错题本
          </button>
        </div>
      ) : (
        <>
          {state && !result && (
            <div className="mt-8 rounded-2xl border border-zinc-100 bg-white p-8 text-center">
              <p className="text-xs font-semibold text-zinc-400">
                请把下面这句话{modeName}成{langMeta(lang).label}
              </p>
              <p className="mt-4 text-2xl font-semibold text-zinc-900">
                {state.prompt}
              </p>
              <p className="mt-4 text-xs text-zinc-400">
                提示：需要用到一个正确的表达
              </p>

              <div className="mt-6 flex flex-col items-center gap-3">
                {isInterpreting && (
                  <button
                    onClick={toggleListening}
                    disabled={loading}
                    className={`rounded-full px-10 py-4 text-base font-semibold text-white transition disabled:opacity-50 ${
                      listening ? "bg-red-600" : "bg-orange-600 hover:bg-orange-700"
                    }`}
                  >
                    {listening ? "停止并提交" : "语音回答"}
                  </button>
                )}

                <div className="flex w-full gap-2">
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submit(answer);
                      }
                    }}
                    rows={isInterpreting ? 1 : 4}
                    maxLength={4000}
                    placeholder={`${isInterpreting ? "或直接输入" : "输入"}${langMeta(lang).short}译文…（Enter 提交，Shift + Enter 换行）`}
                    className="flex-1 resize-y rounded-lg border border-zinc-200 px-4 py-2.5 text-sm leading-6 outline-none focus:border-orange-400"
                  />
                  <button
                    onClick={() => submit(answer)}
                    disabled={loading || !answer.trim()}
                    className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                  >
                    提交
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading && !result && (
            <div className="mt-8 text-center text-zinc-400">
              正在评价你的回答…
            </div>
          )}

          {result && state && (
            <div className="mt-8 rounded-2xl border border-zinc-100 bg-white p-8">
              <div
                className={`rounded-xl p-4 ${
                  result.correct
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                <p className="text-lg font-semibold">
                  {result.correct ? "正确！" : "再想想"}
                </p>
                <p className="mt-1 text-sm">{result.feedback}</p>
              </div>

              <div className="mt-4 rounded-xl bg-zinc-50 p-4">
                <p className="text-xs text-zinc-400">正确表达</p>
                <p className="mt-1 text-lg font-medium text-zinc-900">
                  {state.mistake.correct}
                </p>
                {!result.correct && (
                  <p className="mt-1 text-xs text-zinc-400">
                    易错：{state.mistake.wrong}（{state.mistake.error_type}）
                  </p>
                )}
              </div>

              {result.removed && (
                <p className="mt-3 text-sm text-emerald-600">
                  连续答对，已从错题本移除！
                </p>
              )}

              <button
                onClick={() => next()}
                className="mt-6 rounded-lg bg-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-700"
              >
                下一题
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
