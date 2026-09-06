"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/auth";

interface Reading {
  id: string;
  title: string;
  raw_text: string;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  question_count?: number;
  answered_count?: number;
  done?: boolean;
}

interface Material {
  id: string;
  title: string | null;
  raw_text: string;
}

function readingStatus(r: Reading): { text: string; cls: string } {
  const now = Date.now();
  const start = new Date(r.starts_at).getTime();
  const end = r.ends_at ? new Date(r.ends_at).getTime() : Infinity;
  if (now < start) return { text: "未开始", cls: "bg-zinc-100 text-zinc-500" };
  if (now > end) return { text: "已截止", cls: "bg-red-100 text-red-600" };
  return { text: "进行中", cls: "bg-emerald-100 text-emerald-700" };
}

function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export default function ClassroomAssignmentsPage() {
  const params = useParams<{ id: string }>();
  const [myRole, setMyRole] = useState<"teacher" | "student">("student");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [showPublish, setShowPublish] = useState(false);
  const [pTitle, setPTitle] = useState("");
  const [pText, setPText] = useState("");
  const [pStart, setPStart] = useState("");
  const [pEndDate, setPEndDate] = useState("");
  const [pEndTime, setPEndTime] = useState(nowTime);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    apiFetch(`/api/classrooms/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setMyRole(d.my_role);
      })
      .catch(() => {});

    apiFetch(`/api/classrooms/${params.id}/readings`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setReadings(d.readings ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    apiFetch("/api/materials")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setMaterials(d.materials ?? []);
      })
      .catch(() => {});
  }, [params.id, reloadKey]);

  async function pickMaterial(id: string) {
    const res = await apiFetch(`/api/materials/${id}`);
    const d = await res.json();
    if (res.ok && d.material) {
      if (d.material.title) setPTitle(d.material.title);
      setPText(d.material.raw_text ?? "");
    }
  }

  async function publish() {
    if (!pTitle.trim()) {
      setError("请填写标题");
      return;
    }
    if (!pText.trim()) {
      setError("请填写正文");
      return;
    }
    if (!pEndDate) {
      setError("请设置截止日期");
      return;
    }
    setPublishing(true);
    setError("");
    try {
      const endsAt = `${pEndDate}T${pEndTime || nowTime()}`;
      const res = await apiFetch(`/api/classrooms/${params.id}/readings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pTitle.trim(),
          text: pText.trim(),
          starts_at: pStart,
          ends_at: endsAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "发布失败");
      setShowPublish(false);
      setPTitle("");
      setPText("");
      setPStart("");
      setPEndDate("");
      setPEndTime(nowTime());
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
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
        {myRole === "teacher" ? "布置作业" : "课后作业"}
      </h1>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 必读文章 */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">必读文章</h2>
          {myRole === "teacher" && (
            <button
              onClick={() => setShowPublish(!showPublish)}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              {showPublish ? "收起" : "发布文章"}
            </button>
          )}
        </div>

        {myRole === "teacher" && (
          <p className="mt-2 text-xs text-zinc-400">
            发布后，点进文章可「划线出题」和「勾画批注」，用于准备备课材料。
          </p>
        )}

        {myRole === "teacher" && showPublish && (
          <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50/40 p-4">
            <div className="flex items-center gap-2">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) pickMaterial(e.target.value);
                }}
                className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">从语料库选择…</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title || "未命名文章"}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={pTitle}
              onChange={(e) => setPTitle(e.target.value)}
              placeholder="文章标题"
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
            <textarea
              value={pText}
              onChange={(e) => setPText(e.target.value)}
              placeholder="粘贴文章正文（或从上方语料库选择）"
              rows={5}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-3">
              <label className="text-xs font-semibold text-zinc-600">
                截止日期<span className="text-red-500">（必填）</span>
                <input
                  type="date"
                  value={pEndDate}
                  onChange={(e) => setPEndDate(e.target.value)}
                  className="ml-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-zinc-600">
                截止时间
                <input
                  type="time"
                  value={pEndTime}
                  onChange={(e) => setPEndTime(e.target.value)}
                  className="ml-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-zinc-600">
                开始时间<span className="text-zinc-400">（可选）</span>
                <input
                  type="datetime-local"
                  value={pStart}
                  onChange={(e) => setPStart(e.target.value)}
                  className="ml-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            <button
              onClick={publish}
              disabled={publishing}
              className="mt-3 rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {publishing ? "发布中…" : "发布"}
            </button>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-zinc-400">
              加载中…
            </div>
          ) : readings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-zinc-400">
              还没有必读文章
            </div>
          ) : (
            readings.map((r) => {
              const s = readingStatus(r);
              const isActive = s.text === "进行中";
              const hasQuestions = (r.question_count ?? 0) > 0;
              const pending = myRole === "student" && isActive && !r.done;
              return (
                <div
                  key={r.id}
                  className="group relative rounded-xl border border-zinc-100 bg-white transition hover:shadow-md"
                >
                  <Link
                    href={`/teaching/${params.id}/readings/${r.id}`}
                    className="flex items-center justify-between p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-zinc-900">
                          {r.title}
                        </p>
                        {pending && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">
                        {r.ends_at
                          ? `截止 ${new Date(r.ends_at).toLocaleString("zh-CN")}`
                          : "长期有效"}
                      </p>
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-2">
                      {myRole === "student" && isActive && hasQuestions && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            r.done
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {r.done
                            ? `已完成 ${r.answered_count}/${r.question_count}`
                            : `待完成 ${r.answered_count}/${r.question_count}`}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}
                      >
                        {s.text}
                      </span>
                    </div>
                  </Link>
                  {myRole === "teacher" && (
                    <Link
                      href={`/teaching/${params.id}/readings/${r.id}?prep=1`}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow transition group-hover:opacity-100"
                    >
                      进入备课
                    </Link>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 笔头作业（待开发） */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">笔头作业</h2>
        <div className="mt-3 rounded-2xl border border-dashed border-zinc-200 p-10 text-center text-zinc-400">
          笔头作业功能建设中，敬请期待
        </div>
      </section>
    </div>
  );
}
