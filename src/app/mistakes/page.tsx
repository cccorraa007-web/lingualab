"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import InterpretingPractice from "@/components/InterpretingPractice";
import { apiFetch } from "@/lib/auth";

interface Mistake {
  id: string;
  error_type: string;
  wrong: string;
  correct: string;
  example: string | null;
  note: string | null;
  created_at: string;
}

export default function MistakesPage() {
  const [mode, setMode] = useState<"list" | "practice">("list");
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Mistake | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/mistakes")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) setError(d.error);
        else setMistakes(d.mistakes ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function startEdit(m: Mistake) {
    setEditingId(m.id);
    setEditForm({ ...m });
  }

  async function saveEdit() {
    if (!editForm) return;
    try {
      const res = await apiFetch(`/api/mistakes/${editForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error_type: editForm.error_type,
          wrong: editForm.wrong,
          correct: editForm.correct,
          example: editForm.example,
          note: editForm.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setEditingId(null);
      setEditForm(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确定删除这条错题吗？")) return;
    try {
      await apiFetch(`/api/mistakes/${id}`, { method: "DELETE" });
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (mode === "practice") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <InterpretingPractice onBack={() => setMode("list")} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            错题本
          </h1>
          <p className="mt-2 text-zinc-600">
            提炼你的核心错误点（介词、比较结构、单词等），随时复习纠正。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode("practice")}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            口译练习
          </button>
          <Link
            href="/practice"
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            去口语练习
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {mistakes.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-200 p-10 text-center text-zinc-400">
            还没有错题。在口语练习结束后，从「润色建议」里勾选加入错题本。
          </div>
        )}

        {mistakes.map((m) => (
          <div
            key={m.id}
            className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm"
          >
            {editingId === m.id && editForm ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={editForm.error_type}
                    onChange={(e) =>
                      setEditForm({ ...editForm, error_type: e.target.value })
                    }
                    placeholder="错误类型"
                    className="w-1/3 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                  />
                  <input
                    value={editForm.wrong}
                    onChange={(e) =>
                      setEditForm({ ...editForm, wrong: e.target.value })
                    }
                    placeholder="错误（如 como）"
                    className="w-1/3 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                  />
                  <input
                    value={editForm.correct}
                    onChange={(e) =>
                      setEditForm({ ...editForm, correct: e.target.value })
                    }
                    placeholder="正确（如 en）"
                    className="w-1/3 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                  />
                </div>
                <textarea
                  value={editForm.example ?? ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, example: e.target.value })
                  }
                  placeholder="参考例句"
                  rows={2}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                />
                <input
                  value={editForm.note ?? ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, note: e.target.value })
                  }
                  placeholder="说明（可选）"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                      {m.error_type}
                    </span>
                    <span className="text-base font-medium">
                      <span className="text-red-600 line-through">{m.wrong}</span>
                      <span className="mx-1.5 text-zinc-400">→</span>
                      <span className="text-emerald-700">{m.correct}</span>
                    </span>
                  </div>
                  {m.example && (
                    <p className="mt-2 rounded-lg bg-blue-50 px-3 py-1.5 text-sm text-zinc-700">
                      {m.example}
                    </p>
                  )}
                  {m.note && (
                    <p className="mt-1 text-xs text-zinc-400">{m.note}</p>
                  )}
                  <p className="mt-1 text-xs text-zinc-300">
                    {new Date(m.created_at).toLocaleString("zh-CN")}
                  </p>
                </div>
                <button
                  onClick={() => startEdit(m)}
                  className="shrink-0 rounded-lg px-2 py-1 text-sm text-zinc-400 hover:text-orange-600"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-sm text-zinc-300 hover:bg-red-50 hover:text-red-600"
                >
                  删除
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
