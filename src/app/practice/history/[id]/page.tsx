"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/auth";
import { langMeta, type TargetLang } from "@/lib/language";
import { topicName } from "@/lib/topics";

interface PolishItem {
  original: string;
  revised: string;
  reason: string;
  example: string;
  error_type: string;
  wrong: string;
  correct: string;
}

interface PolishAssessment {
  total_score: number;
  max_score: number;
  dimensions: { name: string; score: number; max_score: number; comment: string }[];
  strengths: string[];
  improvements: string[];
  summary: string;
}

interface Session {
  id: string;
  lang: string;
  topic: string;
  rounds: number;
  transcript: { role: string; content: string }[];
  polish: PolishItem[];
  assessment: PolishAssessment | null;
  created_at: string;
}

export default function PracticeHistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/api/practice/sessions/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setSession(d.session ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-zinc-400">
        加载中…
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-zinc-400">
        {error || "记录不存在"}
      </div>
    );
  }

  const lang = (session.lang === "en" ? "en" : "es") as TargetLang;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href="/practice/history"
        className="text-sm text-zinc-500 hover:text-orange-600"
      >
        ← 返回练习记录
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          {topicName(session.topic)}
        </h1>
        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          {langMeta(lang).label}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-400">
        {new Date(session.created_at).toLocaleString("zh-CN")} · {session.rounds} 轮
      </p>

      {session.assessment && (
        <section className="mt-6 rounded-xl border border-zinc-100 bg-white p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-500">整体评分</p>
              <p className="mt-1 text-4xl font-bold text-orange-600">
                {session.assessment.total_score}
                <span className="ml-1 text-lg font-medium text-zinc-400">
                  / {session.assessment.max_score}
                </span>
              </p>
            </div>
          </div>
          {session.assessment.summary && (
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              {session.assessment.summary}
            </p>
          )}
          {session.assessment.dimensions.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {session.assessment.dimensions.map((d, i) => (
                <div key={`${d.name}-${i}`} className="rounded-lg bg-zinc-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-zinc-800">{d.name}</p>
                    <span className="shrink-0 text-sm font-semibold text-orange-700">
                      {d.score}/{d.max_score}
                    </span>
                  </div>
                  {d.comment && (
                    <p className="mt-1 text-xs leading-5 text-zinc-600">
                      {d.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {session.assessment.strengths.length > 0 && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <p className="text-sm font-semibold text-emerald-800">做得好的地方</p>
                <ul className="mt-2 space-y-1 text-sm leading-6 text-emerald-800">
                  {session.assessment.strengths.map((item, i) => (
                    <li key={`${item}-${i}`} className="flex gap-2">
                      <span aria-hidden="true">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {session.assessment.improvements.length > 0 && (
              <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-4">
                <p className="text-sm font-semibold text-orange-800">下一步建议</p>
                <ul className="mt-2 space-y-1 text-sm leading-6 text-orange-800">
                  {session.assessment.improvements.map((item, i) => (
                    <li key={`${item}-${i}`} className="flex gap-2">
                      <span aria-hidden="true">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-zinc-900">文字稿</h2>
        <div className="mt-3 space-y-2">
          {session.transcript.map((m, i) => (
            <div
              key={i}
              className={`rounded-xl p-3 ${m.role === "assistant" ? "bg-zinc-50" : "bg-orange-50/60"}`}
            >
              <span className="text-xs font-semibold text-zinc-400">
                {m.role === "assistant" ? "考官" : "你"}
              </span>
              <p className="mt-1 text-sm leading-7 text-zinc-700">{m.content}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-zinc-900">AI 润色建议</h2>
        {session.polish.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">
            没有发现明显问题，回答得很地道！
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {session.polish.map((p, i) => (
              <div key={i} className="rounded-xl border border-zinc-100 bg-white p-4">
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
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg bg-red-50/60 p-3">
                    <p className="text-xs font-semibold text-red-500">原文</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-700">{p.original}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50/60 p-3">
                    <p className="text-xs font-semibold text-emerald-600">修改后</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-700">{p.revised}</p>
                  </div>
                </div>
                {p.reason && (
                  <p className="mt-2 text-xs text-zinc-400">说明：{p.reason}</p>
                )}
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
      </section>
    </div>
  );
}
