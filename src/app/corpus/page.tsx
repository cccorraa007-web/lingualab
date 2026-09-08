"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { topicName, resolveTopicSlug } from "@/lib/topics";
import { apiFetch } from "@/lib/auth";
import { langMeta, type TargetLang } from "@/lib/language";

interface Material {
  id: string;
  title: string | null;
  type: string;
  tags: string[];
  cefr_level: string | null;
  lang: string;
  created_at: string;
}

export default function CorpusPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState<TargetLang | "all">("all");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [importing, setImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      let url = "/api/materials";
      const params: string[] = [];
      if (langFilter !== "all") params.push(`lang=${langFilter}`);
      if (search.trim()) {
        const tag = resolveTopicSlug(search);
        if (tag) params.push(`tag=${tag}`);
        else params.push(`q=${encodeURIComponent(search.trim())}`);
      }
      if (params.length > 0) url += `?${params.join("&")}`;
      apiFetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          if (data.error) setError(data.error);
          else setMaterials(data.materials ?? []);
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e));
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search, langFilter, reloadKey]);

  async function handleImport(e: FormEvent) {
    e.preventDefault();
    if (text.trim().length < 50) {
      setError("文本太短，至少需要 50 个字符");
      return;
    }
    setImporting(true);
    setError("");
    try {
      const res = await apiFetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "text",
          title: title.trim() || undefined,
          text: text.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "处理失败");
      router.push(`/corpus/review/${data.materialId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setImporting(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/api/materials/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "识别失败");
      if (!title.trim()) setTitle(data.title || "");
      setText(data.text || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      setFileInputKey((k) => k + 1);
    }
  }

  async function handleDelete(id: string) {
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    setConfirmingId(null);
    try {
      await apiFetch(`/api/materials/${id}`, { method: "DELETE" });
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function startRename(m: Material) {
    setEditingId(m.id);
    setEditTitle(m.title ?? "");
  }

  async function saveRename(id: string) {
    try {
      const res = await apiFetch(`/api/materials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "重命名失败");
      setEditingId(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            语料库
          </h1>
          <p className="mt-2 text-zinc-600">
            按标签或标题检索文章，点进文章查看卡片。
          </p>
        </div>
        <button
          onClick={() => setShowImport(!showImport)}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          {showImport ? "收起" : "导入文章"}
        </button>
      </div>

      {showImport && (
        <form
          onSubmit={handleImport}
          className="mt-6 rounded-xl border border-orange-200 bg-orange-50/40 p-4"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="文章标题（可选，留空可稍后补填）"
            className="mb-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 transition hover:border-orange-300 hover:text-orange-700">
              <input
                key={fileInputKey}
                type="file"
                accept=".docx,.pdf,image/*"
                onChange={handleFile}
                disabled={uploading}
                className="hidden"
              />
              {uploading ? "识别中…" : "上传文件识别（Word / PDF / 图片）"}
            </label>
            <span className="text-xs text-zinc-400">
              上传后自动识别为文字填入下方，可再编辑
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="在这里粘贴文章（至少 50 个字符，语言自动识别）…"
            rows={6}
            className="w-full rounded-xl border border-zinc-200 bg-white p-4 text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={importing || uploading}
              className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {importing ? "AI 提取中…" : "导入并提取语料"}
            </button>
            <span className="text-sm text-zinc-400">处理可能需要几十秒</span>
          </div>
        </form>
      )}

      <div className="mt-6">
        <div className="flex gap-1.5">
          {(["all", "es", "en"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setLangFilter(k)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                langFilter === k
                  ? "bg-orange-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {k === "all" ? "全部" : langMeta(k).label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索标签（如「数字经济」）或文章标题…"
          className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        />
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {materials.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-200 p-10 text-center text-zinc-400">
            {search ? "没有找到匹配的文章" : "还没有文章，点击「导入文章」开始"}
          </div>
        )}

        {materials.map((m) => (
          <div
            key={m.id}
            className="group rounded-xl border border-zinc-100 bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {editingId === m.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      autoFocus
                      className="flex-1 rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-orange-100"
                    />
                    <button
                      onClick={() => saveRename(m.id)}
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
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/corpus/${m.id}`}
                      className="font-semibold text-zinc-900 hover:text-orange-700"
                    >
                      {m.title || "未命名文章"}
                    </Link>
                    <button
                      onClick={() => startRename(m)}
                      className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:text-orange-600"
                    >
                      重命名
                    </button>
                    {m.cefr_level && (
                      <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-zinc-500">
                        {m.cefr_level}
                      </span>
                    )}
                    {(m.lang === "es" || m.lang === "en") && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {langMeta(m.lang as TargetLang).label}
                      </span>
                    )}
                  </div>
                )}
                {m.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700"
                      >
                        {topicName(t)}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-zinc-400">
                  {new Date(m.created_at).toLocaleString("zh-CN")}
                </p>
              </div>
              {confirmingId === m.id ? (
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    确认删除
                  </button>
                  <button
                    onClick={() => setConfirmingId(null)}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                  >
                    取消
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => handleDelete(m.id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-sm text-zinc-300 hover:bg-red-50 hover:text-red-600"
                >
                  删除
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
