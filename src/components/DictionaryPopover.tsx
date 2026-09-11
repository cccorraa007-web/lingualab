"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/auth";
import type { DictionaryEntry } from "@/lib/ai/dictionary";

export default function DictionaryPopover({
  word,
  lang,
  x,
  y,
  onClose,
}: {
  word: string;
  lang: "es" | "en";
  x: number;
  y: number;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiFetch("/api/dictionary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, lang }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d || d.error) throw new Error(d?.error || "查询失败");
        setEntry(d.entry);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [word, lang]);

  useEffect(() => {
    const onScroll = () => onClose();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [onClose]);

  const halfWidth = 160;
  const left = Math.max(halfWidth, Math.min(x, window.innerWidth - halfWidth));

  return (
    <div
      className="fixed z-50 w-80 -translate-x-1/2 rounded-2xl border border-orange-200 bg-white shadow-xl"
      style={{ left, top: Math.max(8, y + 12) }}
    >
      <div className="flex items-start justify-between gap-2 border-b border-zinc-100 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-zinc-900">{word}</p>
          {entry?.partOfSpeech && (
            <p className="mt-0.5 text-xs text-zinc-400">{entry.partOfSpeech}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-md px-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
        >
          关闭
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto px-4 py-3 text-sm">
        {loading ? (
          <p className="py-4 text-center text-zinc-400">查询中…</p>
        ) : error ? (
          <p className="py-2 text-red-600">{error}</p>
        ) : entry ? (
          <div className="space-y-3">
            {entry.translation && (
              <div>
                <p className="text-xs font-semibold text-zinc-400">释义</p>
                <p className="mt-0.5 font-medium text-orange-700">
                  {entry.translation}
                </p>
              </div>
            )}
            {entry.definitions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-zinc-400">
                  {lang === "es" ? "西语释义" : "英语释义"}
                </p>
                <ul className="mt-1 space-y-1">
                  {entry.definitions.map((def, i) => (
                    <li key={i} className="text-zinc-700">
                      {i + 1}. {def}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {entry.examples.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-zinc-400">例句</p>
                <ul className="mt-1 space-y-2">
                  {entry.examples.map((ex, i) => (
                    <li key={i}>
                      <p className="text-zinc-700">{ex.text}</p>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {ex.translation}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
