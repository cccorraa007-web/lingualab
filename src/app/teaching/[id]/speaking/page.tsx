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

function langOf(v: unknown): TargetLang {
  return v === "en" ? "en" : "es";
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
        收藏必读文章、语料库素材与笔头作业，点进去查看批注、作答与分析，并生成针对性课件。
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
            <h2 className="text-lg font-semibold text-zinc-900">已添加的备课素材</h2>
            <div className="mt-3 space-y-2">
              {libraryItems.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-400">
                  还没有添加素材，去「必读文章」里添加，或在下方从语料库/笔头作业导入。
                </p>
              ) : (
                libraryItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/teaching/${params.id}/library/${item.id}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white p-4 transition hover:shadow-md"
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
          </section>
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
