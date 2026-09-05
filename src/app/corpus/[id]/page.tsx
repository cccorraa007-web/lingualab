"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { topicName } from "@/lib/topics";
import { apiFetch } from "@/lib/auth";

interface CardExtra {
  pos?: string;
  freq?: number;
  type?: string;
  register?: string;
  example?: string;
  example_zh?: string;
  useful_chunks?: string[];
  sample_hint?: string;
}

interface Card {
  id: string;
  category: string;
  content: string;
  zh: string | null;
  extra: CardExtra;
  snippet: string | null;
  snippet_zh: string | null;
  status: string;
  created_at: string;
}

interface Annotation {
  id: string;
  material_id: string;
  text: string;
  color: string;
  note: string | null;
  created_at: string;
}

interface Material {
  id: string;
  title: string | null;
  type: string;
  raw_text: string;
  tags: string[];
  cefr_level: string | null;
  translation?: string | null;
  created_at: string;
}

const CATEGORY_STYLE: Record<string, string> = {
  keyword: "bg-sky-100 text-sky-700",
  expression: "bg-orange-100 text-orange-700",
  prompt: "bg-emerald-100 text-emerald-700",
};

const ANNOTATION_BG: Record<string, string> = {
  yellow: "bg-yellow-200",
  red: "bg-red-200",
  blue: "bg-blue-200",
  green: "bg-green-200",
};

const HIGHLIGHT_COLORS = ["yellow", "red", "blue", "green"];

interface Rule {
  text: string;
  className: string;
  note?: string;
}

function buildRules(cards: Card[], annotations: Annotation[]): Rule[] {
  const rules: Rule[] = [];
  for (const c of cards) {
    if (c.category === "keyword") {
      rules.push({ text: c.content, className: "bg-sky-100 text-sky-900" });
    } else if (c.category === "expression") {
      rules.push({ text: c.content, className: "bg-orange-100 text-orange-900" });
    }
  }
  for (const a of annotations) {
    const bg = ANNOTATION_BG[a.color] ?? "bg-yellow-200";
    rules.push({
      text: a.text,
      className: `${bg} ${a.note ? "border-b-2 border-dashed border-zinc-500" : ""}`,
      note: a.note ?? undefined,
    });
  }
  return rules;
}

function renderParagraph(para: string, rules: Rule[]): ReactNode[] {
  const matches: { start: number; end: number; rule: Rule }[] = [];
  const lower = para.toLowerCase();
  for (const rule of rules) {
    const needle = rule.text.toLowerCase();
    if (!needle) continue;
    let idx = lower.indexOf(needle);
    while (idx !== -1) {
      matches.push({ start: idx, end: idx + rule.text.length, rule });
      idx = lower.indexOf(needle, idx + 1);
    }
  }
  matches.sort(
    (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start),
  );

  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const m of matches) {
    if (m.start < cursor) continue;
    if (m.start > cursor) nodes.push(para.slice(cursor, m.start));
    nodes.push(
      <mark
        key={key++}
        className={`rounded-sm px-0.5 ${m.rule.className}`}
        title={m.rule.note}
      >
        {para.slice(m.start, m.end)}
      </mark>,
    );
    cursor = m.end;
  }
  if (cursor < para.length) nodes.push(para.slice(cursor));
  return nodes;
}

function CardItem({
  card,
  onDelete,
}: {
  card: Card;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-white p-4 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-zinc-900">
          {card.content}
          {card.zh && (
            <span className="ml-2 text-sm font-normal text-zinc-500">
              {card.zh}
            </span>
          )}
        </p>

        {card.category === "keyword" && (
          <p className="mt-1 text-xs text-zinc-400">
            {card.extra?.pos && `${card.extra.pos} · `}
            {card.extra?.freq != null && `出现 ${card.extra.freq} 次`}
          </p>
        )}

        {card.category === "expression" && card.extra?.example && (
          <p className="mt-1 text-sm text-zinc-600">
            {card.extra.example}
            {card.extra.example_zh && (
              <span className="text-zinc-400">　{card.extra.example_zh}</span>
            )}
          </p>
        )}

        {card.category === "prompt" && (
          <div className="mt-1 text-xs text-zinc-500">
            {card.extra?.useful_chunks && card.extra.useful_chunks.length > 0 && (
              <p>可用表达：{card.extra.useful_chunks.join(" · ")}</p>
            )}
            {card.extra?.sample_hint && <p>思路：{card.extra.sample_hint}</p>}
          </div>
        )}

        {card.snippet && (
          <p className="mt-2 rounded-lg bg-zinc-50 px-3 py-1.5 text-xs text-zinc-500">
            原文：{card.snippet}
            {card.snippet_zh && (
              <span className="text-zinc-400">（{card.snippet_zh}）</span>
            )}
          </p>
        )}
      </div>
      <button
        onClick={() => onDelete(card.id)}
        className="shrink-0 rounded-lg px-2 py-1 text-sm text-zinc-300 hover:bg-red-50 hover:text-red-600"
      >
        删除
      </button>
    </div>
  );
}

interface ToolbarState {
  text: string;
  x: number;
  y: number;
}

const FILTERS = [
  { value: "all", label: "全部" },
  { value: "keyword", label: "关键词" },
  { value: "expression", label: "表达" },
  { value: "prompt", label: "口语" },
];

export default function MaterialDetailPage() {
  const params = useParams<{ id: string }>();
  const [material, setMaterial] = useState<Material | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showOriginal, setShowOriginal] = useState(true);
  const [translation, setTranslation] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const [noteInput, setNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [cardForm, setCardForm] = useState(false);
  const [cardCategory, setCardCategory] = useState("expression");
  const [cardZh, setCardZh] = useState("");

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
        setCards((d.cards ?? []).filter((c: Card) => c.status === "saved"));
        setAnnotations(d.annotations ?? []);
        setTranslation(d.material.translation ?? "");
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, reloadKey]);

  const keywords = cards.filter((c) => c.category === "keyword");
  const expressions = cards.filter((c) => c.category === "expression");
  const prompts = cards.filter((c) => c.category === "prompt");

  async function handleDeleteCard(id: string) {
    try {
      await apiFetch(`/api/cards/${id}`, { method: "DELETE" });
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDeleteAnnotation(id: string) {
    try {
      await apiFetch(`/api/annotations/${id}`, { method: "DELETE" });
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleMouseUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (!text) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setToolbar({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
    setNoteInput(false);
    setCardForm(false);
  }

  async function createAnnotation(color: string, note?: string) {
    if (!toolbar) return;
    try {
      const res = await apiFetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material_id: params.id,
          text: toolbar.text,
          color,
          note: note?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setToolbar(null);
      setNoteInput(false);
      setNoteText("");
      window.getSelection()?.removeAllRanges();
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function createCardFromSelection() {
    if (!toolbar) return;
    try {
      const res = await apiFetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material_id: params.id,
          category: cardCategory,
          content: toolbar.text,
          zh: cardZh.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成失败");
      setToolbar(null);
      setCardForm(false);
      setCardZh("");
      window.getSelection()?.removeAllRanges();
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleTranslate() {
    setTranslating(true);
    setError("");
    try {
      const res = await apiFetch(`/api/materials/${params.id}/translate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "翻译失败");
      setTranslation(data.translation);
      setShowTranslation(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTranslating(false);
    }
  }

  if (!material) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-zinc-400">
        {error ? error : "加载中…"}
      </div>
    );
  }

  const rules = buildRules(cards, annotations);

  const sections = [
    { key: "keyword", title: "关键词", items: keywords },
    { key: "expression", title: "地道表达", items: expressions },
    { key: "prompt", title: "口语练习", items: prompts },
  ].filter((s) => filter === "all" || s.key === filter);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link href="/corpus" className="text-sm text-zinc-500 hover:text-orange-600">
        ← 返回语料库
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          {material.title || "未命名文章"}
        </h1>
        {material.cefr_level && (
          <span className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-500">
            {material.cefr_level}
          </span>
        )}
      </div>

      {material.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {material.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700"
            >
              {topicName(t)}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => setShowOriginal(!showOriginal)}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          {showOriginal ? "收起原文" : "查看原文"}
        </button>
        <span className="ml-auto text-xs text-zinc-400">
          选中原文文字可高亮、批注或生成卡片
        </span>
      </div>

      {showOriginal && (
        <>
          <div
            onMouseUp={handleMouseUp}
            className="mt-4 rounded-xl border border-zinc-100 bg-white p-6 text-[17px] leading-8 text-zinc-800 shadow-sm"
          >
            {material.raw_text
              .split(/\n+/)
              .filter((p) => p.trim())
              .map((para, i) => (
                <p key={i} className="mb-4 last:mb-0">
                  {renderParagraph(para, rules)}
                </p>
              ))}
          </div>

          <div className="mt-3 flex items-center gap-3">
            {translation ? (
              <button
                onClick={() => setShowTranslation(!showTranslation)}
                className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50"
              >
                {showTranslation ? "收起翻译" : "查看翻译"}
              </button>
            ) : (
              <button
                onClick={handleTranslate}
                disabled={translating}
                className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                {translating ? "翻译中…" : "查看翻译"}
              </button>
            )}
          </div>

          {showTranslation && translation && (
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/40 p-5 text-[16px] leading-8 text-zinc-700">
              {translation
                .split(/\n+/)
                .filter((p) => p.trim())
                .map((p, i) => (
                  <p key={i} className="mb-3 last:mb-0">
                    {p}
                  </p>
                ))}
            </div>
          )}
        </>
      )}

      {annotations.length > 0 && (
        <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/60 p-4">
          <h3 className="text-sm font-semibold text-zinc-700">我的批注</h3>
          <ul className="mt-2 space-y-2">
            {annotations.map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-2 rounded-lg border border-zinc-100 bg-white p-3"
              >
                <span className={`rounded px-1.5 py-0.5 text-sm font-medium ${ANNOTATION_BG[a.color] ?? "bg-yellow-200"}`}>
                  {a.text}
                </span>
                {a.note && (
                  <span className="flex-1 text-sm text-zinc-600">{a.note}</span>
                )}
                <button
                  onClick={() => handleDeleteAnnotation(a.id)}
                  className="shrink-0 text-sm text-zinc-300 hover:text-red-600"
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-8 flex items-center gap-2 border-b border-zinc-100 pb-3">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === f.value
                ? "bg-orange-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {sections.map((section) => (
        <section key={section.key} className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
            <span
              className={`rounded-md px-2 py-0.5 text-xs ${CATEGORY_STYLE[section.key]}`}
            >
              {section.title}
            </span>
            <span className="text-sm font-normal text-zinc-400">
              {section.items.length} 条
            </span>
          </h2>
          <div className="mt-3 space-y-3">
            {section.items.length === 0 && (
              <p className="text-sm text-zinc-400">暂无</p>
            )}
            {section.items.map((card) => (
              <CardItem key={card.id} card={card} onDelete={handleDeleteCard} />
            ))}
          </div>
        </section>
      ))}

      {toolbar && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full rounded-xl border border-zinc-200 bg-white p-2 shadow-lg"
          style={{ left: toolbar.x, top: toolbar.y - 8 }}
        >
          <div className="flex items-center gap-1.5">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => createAnnotation(color)}
                title={color}
                className={`h-6 w-6 rounded-full border border-zinc-200 ${ANNOTATION_BG[color]}`}
              />
            ))}
            <span className="mx-1 h-5 w-px bg-zinc-200" />
            <button
              onClick={() => {
                setNoteInput(true);
                setCardForm(false);
              }}
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
            >
              批注
            </button>
            <button
              onClick={() => {
                setCardForm(true);
                setNoteInput(false);
              }}
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
            >
              生成卡片
            </button>
            <button
              onClick={() => setToolbar(null)}
              className="rounded-md px-1.5 py-1 text-xs text-zinc-400 hover:bg-zinc-100"
            >
              ×
            </button>
          </div>

          {noteInput && (
            <div className="mt-2 border-t border-zinc-100 pt-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="写批注…"
                rows={2}
                autoFocus
                className="w-full rounded-lg border border-zinc-200 p-2 text-xs outline-none focus:border-orange-400"
              />
              <button
                onClick={() => createAnnotation("yellow", noteText)}
                className="mt-1 rounded-md bg-orange-600 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-700"
              >
                保存批注
              </button>
            </div>
          )}

          {cardForm && (
            <div className="mt-2 border-t border-zinc-100 pt-2">
              <div className="flex gap-2">
                <select
                  value={cardCategory}
                  onChange={(e) => setCardCategory(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-200 p-1.5 text-xs"
                >
                  <option value="expression">表达</option>
                  <option value="keyword">关键词</option>
                  <option value="prompt">口语问题</option>
                </select>
                <input
                  value={cardZh}
                  onChange={(e) => setCardZh(e.target.value)}
                  placeholder="中文释义（可选）"
                  className="flex-1 rounded-lg border border-zinc-200 p-1.5 text-xs"
                />
              </div>
              <button
                onClick={createCardFromSelection}
                className="mt-1 rounded-md bg-orange-600 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-700"
              >
                生成卡片
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
