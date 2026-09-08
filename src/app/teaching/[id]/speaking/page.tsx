"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/auth";
import { langMeta, type TargetLang } from "@/lib/language";

interface Material {
  id: string;
  title: string | null;
  lang: string;
}

interface Reading {
  id: string;
  title: string;
}

interface Assignment {
  id: string;
  title: string;
}

interface LibraryItem {
  id: string;
  source: "material" | "reading" | "assignment";
  source_id: string;
  title: string;
  created_at: string;
}

const SOURCE_LABEL: Record<string, string> = {
  material: "语料库",
  reading: "必读文章",
  assignment: "笔头作业",
};

const LESSON_TYPES = [
  { value: "blank", label: "填空题" },
  { value: "choice", label: "选择题" },
  { value: "truefalse", label: "判断题" },
  { value: "qa", label: "问答题" },
];

function langOf(v: unknown): TargetLang {
  return v === "en" ? "en" : "es";
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function LessonLibraryPage() {
  const params = useParams<{ id: string }>();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [format, setFormat] = useState<"pptx" | "docx">("pptx");
  const [types, setTypes] = useState<string[]>(["blank", "choice"]);
  const [count, setCount] = useState(10);
  const [wordExplanation, setWordExplanation] = useState(false);
  const [extra, setExtra] = useState("");
  const [generating, setGenerating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [result, setResult] = useState<{ filename: string; dataUrl: string } | null>(null);
  const [genError, setGenError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch("/api/materials").then((r) => r.json()),
      apiFetch(`/api/classrooms/${params.id}/readings`).then((r) => r.json()),
      apiFetch(`/api/classrooms/${params.id}/assignments`).then((r) => r.json()),
      apiFetch(`/api/classrooms/${params.id}/library/items`).then((r) => r.json()),
    ])
      .then(([mat, rdg, asg, lib]) => {
        if (cancelled) return;
        setMaterials(mat.materials ?? []);
        setReadings(rdg.readings ?? []);
        setAssignments(asg.assignments ?? []);
        setLibraryItems(lib.items ?? []);
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
  }, [params.id, reloadKey]);

  const addedKeys = new Set(
    libraryItems.map((i) => `${i.source}:${i.source_id}`),
  );

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function addSelected() {
    const keys = [...selected];
    if (keys.length === 0) return;
    setAdding(true);
    setError("");
    try {
      for (const key of keys) {
        const [source, source_id] = key.split(":");
        await apiFetch(`/api/classrooms/${params.id}/library/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, source_id }),
        });
      }
      setSelected(new Set());
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  }

  function toggleType(t: string) {
    setTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  async function removeItem(item: LibraryItem) {
    setRemovingId(item.id);
    setError("");
    try {
      const res = await apiFetch(
        `/api/classrooms/${params.id}/library/items/${item.id}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRemovingId(null);
    }
  }

  async function generate() {
    if (libraryItems.length === 0) return;
    if (types.length === 0) {
      setGenError("请至少选择一种题型");
      return;
    }
    setGenerating(true);
    setGenError("");
    setResult(null);
    try {
      const items = libraryItems.map((i) => ({
        source: i.source,
        id: i.source_id,
      }));
      const res = await apiFetch(`/api/classrooms/${params.id}/library`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          format,
          questionTypes: types,
          questionCount: count,
          extra,
          wordExplanation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成失败");
      setResult({ filename: data.filename, dataUrl: data.dataUrl });
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function downloadAndClear() {
    if (result) {
      triggerDownload(result.dataUrl, result.filename);
    }
    setResult(null);
    setShowModal(false);
    setClearing(true);
    try {
      await apiFetch(`/api/classrooms/${params.id}/library/items`, {
        method: "DELETE",
      });
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href={`/teaching/${params.id}`}
        className="text-sm text-zinc-500 hover:text-orange-600"
      >
        ← 返回班级
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
        备课资料库
      </h1>
      <p className="mt-2 text-zinc-600">
        先勾选要备课的素材加入资料库，再基于库里全部素材一键生成 PPT 或 Word 课件；下载后资料库自动清空，方便下次重新备课。
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 text-center text-zinc-400">加载中…</div>
      ) : (
        <div className="mt-6 space-y-8">
          {/* 已添加的备课素材 */}
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">
                已添加的备课素材
              </h2>
              <button
                onClick={() => {
                  setGenError("");
                  setShowModal(true);
                }}
                disabled={libraryItems.length === 0}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                生成课件
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {libraryItems.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-400">
                  还没有添加素材，去「必读文章」里添加，或在下方从语料库/笔头作业导入。
                </p>
              ) : (
                libraryItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white p-4 transition hover:shadow-md"
                  >
                    <Link
                      href={`/teaching/${params.id}/library/${item.id}`}
                      className="flex min-w-0 flex-1 items-center justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                            {SOURCE_LABEL[item.source]}
                          </span>
                          <p className="truncate font-medium text-zinc-900">
                            {item.title}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-zinc-400">
                          {new Date(item.created_at).toLocaleString("zh-CN")}
                        </p>
                      </div>
                      <span className="ml-4 shrink-0 text-sm text-orange-600">
                        查看 →
                      </span>
                    </Link>
                    <button
                      onClick={() => removeItem(item)}
                      disabled={removingId === item.id}
                      className="ml-4 shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {removingId === item.id ? "删除中…" : "删除"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 添加素材 */}
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">添加素材</h2>
              <button
                onClick={addSelected}
                disabled={selected.size === 0 || adding}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {adding ? "添加中…" : `添加到资料库（已选 ${selected.size}）`}
              </button>
            </div>

            <SourceSection
              title="语料库"
              hint="你平日阅读收录的素材"
              empty="语料库暂无素材，可先去「语料库」导入文章"
            >
              {materials.map((m) => (
                <SelectableRow
                  key={m.id}
                  alreadyAdded={addedKeys.has(`material:${m.id}`)}
                  checked={selected.has(`material:${m.id}`)}
                  onToggle={() => toggle(`material:${m.id}`)}
                  title={m.title || "未命名素材"}
                  badge={langMeta(langOf(m.lang)).label}
                />
              ))}
            </SourceSection>

            <SourceSection
              title="发布的必读文章"
              hint="班级里已发布、含学生作答情况的文章"
              empty="还没有发布必读文章"
            >
              {readings.map((r) => (
                <SelectableRow
                  key={r.id}
                  alreadyAdded={addedKeys.has(`reading:${r.id}`)}
                  checked={selected.has(`reading:${r.id}`)}
                  onToggle={() => toggle(`reading:${r.id}`)}
                  title={r.title}
                />
              ))}
            </SourceSection>

            <SourceSection
              title="发布的笔头作业"
              hint="班级里已发布、含学生提交与批改情况的作业"
              empty="还没有发布笔头作业"
            >
              {assignments.map((a) => (
                <SelectableRow
                  key={a.id}
                  alreadyAdded={addedKeys.has(`assignment:${a.id}`)}
                  checked={selected.has(`assignment:${a.id}`)}
                  onToggle={() => toggle(`assignment:${a.id}`)}
                  title={a.title}
                />
              ))}
            </SourceSection>
          </section>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900">生成课件</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                关闭
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              将基于资料库里全部 {libraryItems.length} 个素材生成
            </p>

            {result ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-medium text-emerald-700">课件已生成</p>
                <p className="mt-1 break-all text-xs text-zinc-500">
                  {result.filename}
                </p>
                <button
                  onClick={downloadAndClear}
                  disabled={clearing}
                  className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {clearing ? "下载并清空资料库…" : "下载课件"}
                </button>
                <p className="mt-2 text-xs text-zinc-400">
                  下载后资料库会自动清空，下次生成需重新添加素材。
                </p>
              </div>
            ) : (
              <>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-zinc-700">文件格式</p>
                  <div className="mt-2 flex gap-2">
                    {(["pptx", "docx"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormat(f)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                          format === f
                            ? "border-orange-500 bg-orange-50 text-orange-700"
                            : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        {f === "pptx" ? "PPT 演示文稿" : "Word 文档"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-zinc-700">包含题型</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {LESSON_TYPES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => toggleType(t.value)}
                        className={`rounded-lg border px-3 py-1.5 text-sm ${
                          types.includes(t.value)
                            ? "border-orange-500 bg-orange-50 text-orange-700"
                            : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-zinc-700">题目数量</p>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value) || 1)}
                    className="mt-2 w-28 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                  />
                </div>

                <label className="mt-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={wordExplanation}
                    onChange={(e) => setWordExplanation(e.target.checked)}
                    className="h-4 w-4 accent-orange-600"
                  />
                  <span className="text-sm font-semibold text-zinc-700">
                    需要单词讲解
                  </span>
                </label>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-zinc-700">
                    补充需求（可选）
                  </p>
                  <textarea
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                    placeholder="例如：侧重语法点、加入课堂讨论环节…"
                    rows={3}
                    className="mt-2 w-full rounded-lg border border-zinc-200 p-2 text-sm outline-none focus:border-orange-400"
                  />
                </div>

                {genError && (
                  <p className="mt-3 text-sm text-red-600">{genError}</p>
                )}

                <button
                  onClick={generate}
                  disabled={generating}
                  className="mt-4 w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {generating ? "AI 生成中…（可能需要一段时间）" : "生成课件"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SourceSection({
  title,
  hint,
  empty,
  children,
}: {
  title: string;
  hint: string;
  empty: string;
  children: React.ReactNode;
}) {
  const count = Array.isArray(children) ? children.length : 0;
  return (
    <div className="mt-6">
      <h3 className="text-base font-semibold text-zinc-800">{title}</h3>
      <p className="mt-1 text-xs text-zinc-400">{hint}</p>
      <div className="mt-3 space-y-2">
        {count === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-400">
            {empty}
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function SelectableRow({
  checked,
  onToggle,
  title,
  badge,
  alreadyAdded,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  badge?: string;
  alreadyAdded?: boolean;
}) {
  if (alreadyAdded) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
        <span className="text-sm text-emerald-600">✓</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-400">{title}</p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          已添加
        </span>
      </div>
    );
  }
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-100 bg-white p-4 transition hover:shadow-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-4 w-4 accent-orange-600"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900">{title}</p>
      </div>
      {badge && (
        <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
          {badge}
        </span>
      )}
    </label>
  );
}
