"use client";

import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/auth";
import { langMeta, type TargetLang } from "@/lib/language";
import type { WritingPolishResult } from "@/lib/ai/writing";

export default function PolishPage() {
  const [lang, setLang] = useState<TargetLang>("es");
  const languageName = langMeta(lang).label;
  const [title, setTitle] = useState("");
  const [essay, setEssay] = useState("");
  const [rubric, setRubric] = useState("");
  const [result, setResult] = useState<WritingPolishResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return setError("请填写作文题目");
    if (essay.trim().length < 20) return setError("作文正文至少需要 20 个字符");
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      const response = await apiFetch("/api/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, essay, rubric, lang }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "润色失败");
      setResult(data as WritingPolishResult);
      setSelected(new Set());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "润色失败");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelected(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    setSaved(false);
  }

  function toggleAll() {
    if (!result) return;
    const eligible = result.polish
      .map((item, index) => (item.wrong && item.correct ? index : -1))
      .filter((index) => index >= 0);
    setSelected((current) =>
      current.size === eligible.length ? new Set() : new Set(eligible),
    );
    setSaved(false);
  }

  async function saveMistakes() {
    if (!result || selected.size === 0) return;
    const items = [...selected]
      .sort((a, b) => a - b)
      .map((index) => result.polish[index])
      .filter((item) => item?.wrong && item.correct)
      .map((item) => ({
        error_type: item.error_type,
        wrong: item.wrong,
        correct: item.correct,
        example: item.example || null,
        note: item.reason || null,
      }));
    if (items.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch("/api/mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, lang }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      setSaved(true);
      setSelected(new Set());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  const eligibleCount = result?.polish.filter((item) => item.wrong && item.correct).length ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="text-sm font-semibold text-orange-600">自学模式</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900">写作润色</h1>
      <p className="mt-2 max-w-3xl text-zinc-600">
        提交{languageName}作文，获得逐条纠错、分维度评分和改进建议。明确的错误可以直接收进错题本。
      </p>

      <div className="mt-6 flex items-center gap-2">
        <span className="text-sm font-medium text-zinc-600">写作语言</span>
        {(["es", "en"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setLang(key);
              setResult(null);
              setSelected(new Set());
              setSaved(false);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              lang === key
                ? "bg-orange-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {langMeta(key).label}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-5 rounded-2xl border border-orange-100 bg-orange-50/30 p-5 sm:p-6"
        aria-busy={loading}
      >
        <Field label="作文题目" count={`${title.length}/500`}>
          <textarea
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            rows={2}
            maxLength={500}
            required
            placeholder="粘贴作文题目或写作要求"
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </Field>
        <Field label="作文正文" count={`${essay.length}/12000`}>
          <textarea
            value={essay}
            onChange={(event) => setEssay(event.target.value)}
            rows={12}
            minLength={20}
            maxLength={12000}
            required
            placeholder={`在这里粘贴${languageName}作文（至少 20 个字符）`}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-7 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </Field>
        <Field label="评分标准（可选）" count={`${rubric.length}/4000`}>
          <textarea
            value={rubric}
            onChange={(event) => setRubric(event.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="可粘贴老师或考试提供的评分标准；留空将使用默认百分制"
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "AI 正在分析…" : "开始润色与评分"}
          </button>
          <span className="text-sm text-zinc-400">分析通常需要几十秒</span>
        </div>
      </form>

      {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {result && (
        <div className="mt-8 space-y-8" aria-live="polite">
          <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-zinc-500">整体评分</p>
                <p className="mt-1 text-4xl font-bold text-orange-600">
                  {result.assessment.total_score}
                  <span className="ml-1 text-lg font-medium text-zinc-400">/ {result.assessment.max_score}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setResult(null); setSelected(new Set()); setSaved(false); }}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                修改作文后重新分析
              </button>
            </div>
            {result.assessment.summary && <p className="mt-4 leading-7 text-zinc-700">{result.assessment.summary}</p>}
            {result.assessment.dimensions.length > 0 && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {result.assessment.dimensions.map((dimension, index) => (
                  <div key={`${dimension.name}-${index}`} className="rounded-xl bg-zinc-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-zinc-800">{dimension.name}</p>
                      <span className="shrink-0 text-sm font-semibold text-orange-700">{dimension.score}/{dimension.max_score}</span>
                    </div>
                    {dimension.comment && <p className="mt-2 text-sm leading-6 text-zinc-600">{dimension.comment}</p>}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <FeedbackList title="做得好的地方" items={result.assessment.strengths} tone="good" />
              <FeedbackList title="下一步建议" items={result.assessment.improvements} tone="improve" />
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">逐条润色建议</h2>
                <p className="mt-1 text-sm text-zinc-500">勾选建议，可加入错题本继续练习。</p>
              </div>
              {eligibleCount > 0 && (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={toggleAll} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
                    {selected.size === eligibleCount ? "取消全选" : "全选"}
                  </button>
                  <button type="button" onClick={saveMistakes} disabled={selected.size === 0 || saving} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
                    {saving ? "保存中…" : `加入错题本（${selected.size}）`}
                  </button>
                </div>
              )}
            </div>
            {saved && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">已加入错题本，可前往错题本继续复习。</p>}
            {result.polish.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-8 text-center text-sm text-emerald-700">没有发现需要逐条纠正的明显问题。</div>
            ) : (
              <div className="mt-4 space-y-4">
                {result.polish.map((item, index) => (
                  <article key={`${item.original}-${index}`} className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={selected.has(index)} onChange={() => toggleSelected(index)} aria-label={`选择第 ${index + 1} 条润色建议`} className="mt-1 h-4 w-4 accent-orange-600" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{item.error_type}</span>
                          <span className="text-sm"><span className="text-red-600 line-through">{item.wrong}</span><span className="mx-2 text-zinc-400">→</span><span className="font-medium text-emerald-700">{item.correct}</span></span>
                        </div>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          <TextPanel label="原文" text={item.original} tone="bad" />
                          <TextPanel label="修改后" text={item.revised} tone="good" />
                        </div>
                        {item.reason && <p className="mt-3 text-sm leading-6 text-zinc-600"><span className="font-semibold text-zinc-700">说明：</span>{item.reason}</p>}
                        {item.example && <p className="mt-2 text-sm leading-6 text-zinc-500"><span className="font-semibold text-zinc-600">参考例句：</span>{item.example}</p>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Field({ label, count, children }: { label: string; count: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm font-semibold text-zinc-800">{label}</span>{children}<span className="mt-1 block text-right text-xs text-zinc-400">{count}</span></label>;
}

function FeedbackList({ title, items, tone }: { title: string; items: string[]; tone: "good" | "improve" }) {
  if (items.length === 0) return null;
  const classes = tone === "good" ? "border-emerald-100 bg-emerald-50/60 text-emerald-800" : "border-orange-100 bg-orange-50/60 text-orange-800";
  return <div className={`rounded-xl border p-4 ${classes}`}><p className="text-sm font-semibold">{title}</p><ul className="mt-2 space-y-1 text-sm leading-6">{items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><span aria-hidden="true">•</span><span>{item}</span></li>)}</ul></div>;
}

function TextPanel({ label, text, tone }: { label: string; text: string; tone: "bad" | "good" }) {
  const classes = tone === "bad" ? "bg-red-50/60 text-red-500" : "bg-emerald-50/60 text-emerald-600";
  return <div className={`rounded-lg p-3 ${classes}`}><p className="text-xs font-semibold">{label}</p><p className="mt-1 text-sm leading-6 text-zinc-700">{text}</p></div>;
}
