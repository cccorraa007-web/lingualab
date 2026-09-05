"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TOPICS, topicName } from "@/lib/topics";
import { apiFetch } from "@/lib/auth";

interface ItemExtra {
  pos?: string;
  freq?: number;
  type?: string;
  register?: string;
  example?: string;
  example_zh?: string;
  useful_chunks?: string[];
  sample_hint?: string;
}

interface Item {
  id: string;
  category: string;
  content: string;
  zh: string | null;
  extra: ItemExtra;
  snippet: string | null;
  snippet_zh: string | null;
  status: string;
}

interface Material {
  id: string;
  title: string | null;
  raw_text: string;
  tags: string[];
  cefr_level: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  keyword: "关键词",
  expression: "表达",
  prompt: "口语",
};

const CATEGORY_STYLE: Record<string, string> = {
  keyword: "bg-sky-100 text-sky-700",
  expression: "bg-orange-100 text-orange-700",
  prompt: "bg-emerald-100 text-emerald-700",
};

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [material, setMaterial] = useState<Material | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/materials/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) {
          setError(d.error);
          return;
        }
        setMaterial(d.material);
        setTitle(d.material.title ?? "");
        setTags(d.material.tags ?? []);
        setItems(d.cards ?? []);
        setSelected(new Set((d.cards ?? []).map((i: Item) => i.id)));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addTag() {
    const input = tagInput.trim();
    if (!input) return;
    const topic = TOPICS.find(
      (t) => t.slug === input || t.name_zh === input,
    );
    const slug = topic ? topic.slug : input;
    if (!tags.includes(slug)) setTags([...tags, slug]);
    setTagInput("");
  }

  function removeTag(slug: string) {
    setTags(tags.filter((t) => t !== slug));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const resM = await apiFetch(`/api/materials/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || null, tags }),
      });
      const dM = await resM.json();
      if (!resM.ok) throw new Error(dM.error || "更新失败");

      const selectedItems = items.filter((i) => selected.has(i.id));
      const unselected = items.filter((i) => !selected.has(i.id));

      if (selectedItems.length > 0) {
        const res = await apiFetch("/api/cards", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: selectedItems.map((i) => i.id) }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "保存失败");
      }
      for (const it of unselected) {
        await apiFetch(`/api/cards/${it.id}`, { method: "DELETE" });
      }
      router.push(`/corpus/${params.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  if (error && !material) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-zinc-600">
        {error}
      </div>
    );
  }

  if (!material) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-zinc-400">
        加载中…
      </div>
    );
  }

  const availableTags = TOPICS.filter((t) => !tags.includes(t.slug));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        复查提取结果
      </h1>
      <p className="mt-2 text-zinc-600">
        确认标题和标签，勾选想保留的卡片，未勾选的会被丢弃。
      </p>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
        <label className="text-sm font-semibold text-zinc-700">文章标题</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="输入文章标题"
          className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        />

        <label className="mt-4 block text-sm font-semibold text-zinc-700">
          标签
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700"
            >
              {topicName(t)}
              <button
                onClick={() => removeTag(t)}
                className="text-orange-500 hover:text-orange-800"
              >
                ×
              </button>
            </span>
          ))}
          {tags.length === 0 && (
            <span className="text-sm text-zinc-400">暂无标签，请添加</span>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <select
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">选择要添加的标签…</option>
            {availableTags.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name_zh}
              </option>
            ))}
          </select>
          <button
            onClick={addTag}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            添加
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 border-b border-zinc-100 pb-3">
        <span className="text-sm text-zinc-600">
          共 {items.length} 条，已选 {selected.size} 条
        </span>
        <button
          onClick={() => setSelected(new Set(items.map((i) => i.id)))}
          className="text-sm text-zinc-500 hover:text-orange-600"
        >
          全选
        </button>
        <button
          onClick={() => setSelected(new Set())}
          className="text-sm text-zinc-500 hover:text-orange-600"
        >
          清空
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {items.map((item) => {
          const checked = selected.has(item.id);
          return (
            <label
              key={item.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                checked
                  ? "border-orange-300 bg-orange-50/40"
                  : "border-zinc-100 bg-white opacity-60"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(item.id)}
                className="mt-1 h-4 w-4 accent-orange-600"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold ${CATEGORY_STYLE[item.category] ?? "bg-zinc-100 text-zinc-600"}`}
                  >
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </span>
                  <span className="font-medium text-zinc-900">
                    {item.content}
                  </span>
                  {item.zh && (
                    <span className="text-sm text-zinc-500">{item.zh}</span>
                  )}
                </div>

                {item.category === "expression" && item.extra?.example && (
                  <p className="mt-1 text-sm text-zinc-600">
                    {item.extra.example}
                    {item.extra.example_zh && (
                      <span className="text-zinc-400">
                        　{item.extra.example_zh}
                      </span>
                    )}
                  </p>
                )}

                {item.category === "prompt" && (
                  <div className="mt-1 text-xs text-zinc-500">
                    {item.extra?.useful_chunks &&
                      item.extra.useful_chunks.length > 0 && (
                        <p>可用表达：{item.extra.useful_chunks.join(" · ")}</p>
                      )}
                    {item.extra?.sample_hint && (
                      <p>思路：{item.extra.sample_hint}</p>
                    )}
                  </div>
                )}

                {item.snippet && (
                  <p className="mt-1.5 rounded-lg bg-white/70 px-3 py-1.5 text-xs text-zinc-500">
                    原文：{item.snippet}
                    {item.snippet_zh && (
                      <span className="text-zinc-400">（{item.snippet_zh}）</span>
                    )}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {saving ? "保存中…" : `保存选中的 ${selected.size} 张卡片`}
        </button>
        <button
          onClick={() => router.push("/corpus")}
          className="rounded-lg border border-zinc-200 px-6 py-3 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          取消
        </button>
      </div>
    </div>
  );
}
