"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/auth";
import { langMeta, type TargetLang } from "@/lib/language";
import { topicName } from "@/lib/topics";

interface Session {
  id: string;
  lang: string;
  topic: string;
  rounds: number;
  transcript: { role: string; content: string }[];
  polish: unknown[];
  created_at: string;
}

export default function PracticeHistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/practice/sessions")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setSessions(d.sessions ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href="/practice"
        className="text-sm text-zinc-500 hover:text-orange-600"
      >
        ← 返回口语练习
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
        口语练习记录
      </h1>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-center text-zinc-400">加载中…</p>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 p-10 text-center text-zinc-400">
            还没有练习记录，去口语练习一次后回来查看吧。
          </div>
        ) : (
          sessions.map((s) => (
            <Link
              key={s.id}
              href={`/practice/history/${s.id}`}
              className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white p-4 transition hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                    {topicName(s.topic)}
                  </span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {langMeta((s.lang === "en" ? "en" : "es") as TargetLang).label}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  {s.rounds} 轮 · {s.polish.length} 条润色建议
                </p>
              </div>
              <div className="ml-4 shrink-0 text-right">
                <p className="text-xs text-zinc-400">
                  {new Date(s.created_at).toLocaleString("zh-CN")}
                </p>
                <p className="mt-1 text-xs text-orange-600">查看详情 →</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
