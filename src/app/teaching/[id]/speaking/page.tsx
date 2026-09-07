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

const LESSON_TYPES = [
  { value: "blank", label: "填空题" },
  { value: "choice", label: "选择题" },
  { value: "truefalse", label: "判断题" },
  { value: "qa", label: "问答题" },
];

function langOf(v: unknown): TargetLang {
  return v === "en" ? "en" : "es";
}

export default function LessonLibraryPage() {
  const params = useParams<{ id: string }>();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [format, setFormat] = useState<"pptx" | "docx">("pptx");
  const [types, setTypes] = useState<string[]>(["blank", "choice"]);
  const [count, setCount] = useState(10);
  const [wordExplanation, setWordExplanation] = useState(false);
  const [extra, setExtra] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    filename: string;
    dataUrl: string;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/materials").then((r) => r.json()),
      apiFetch(`/api/classrooms/${params.id}/readings`).then((r) => r.json()),
      apiFetch(`/api/classrooms/${params.id}/assignments`).then((r) => r.json()),
    ])
      .then(([mat, rdg, asg]) => {
        setMaterials(mat.materials ?? []);
        setReadings(rdg.readings ?? []);
        setAssignments(asg.assignments ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [params.id]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleType(t: string) {
    setTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  async function generate() {
    if (types.length === 0) {
      setError("请至少选择一种题型");
      return;
    }
    const items = [...selected].map((key) => {
      const [source, id] = key.split(":");
      return { source, id };
    });
    setGenerating(true);
    setError("");
    setResult(null);
    try {
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
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  const selectedCount = selected.size;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href={`/teaching/${params.id}`}
        className="text-sm text-zinc-500 hover:text-orange-600"
      >
        ← 返回班级
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            备课资料库
          </h1>
          <p className="mt-2 text-zinc-600">
            从语料库、必读文章、笔头作业导入素材，勾选后生成针对性课件。
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={selectedCount === 0}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          生成课件（已选 {selectedCount}）
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 text-center text-zinc-400">加载中…</div>
      ) : (
        <div className="mt-6 space-y-8">
          <SourceSection
            title="语料库"
            hint="你平日阅读收录的素材"
            empty="语料库暂无素材，可先去「语料库」导入文章"
          >
            {materials.map((m) => (
              <SelectableRow
                key={m.id}
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
                checked={selected.has(`assignment:${a.id}`)}
                onToggle={() => toggle(`assignment:${a.id}`)}
                title={a.title}
              />
            ))}
          </SourceSection>
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

            {result ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-medium text-emerald-700">课件已生成</p>
                <p className="mt-1 break-all text-xs text-zinc-500">
                  {result.filename}
                </p>
                <a
                  href={result.dataUrl}
                  download={result.filename}
                  className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  下载课件
                </a>
                <button
                  onClick={() => {
                    setResult(null);
                    setShowModal(false);
                  }}
                  className="ml-2 text-sm text-zinc-500 hover:text-zinc-700"
                >
                  完成
                </button>
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
    <section>
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
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
    </section>
  );
}

function SelectableRow({
  checked,
  onToggle,
  title,
  badge,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  badge?: string;
}) {
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
