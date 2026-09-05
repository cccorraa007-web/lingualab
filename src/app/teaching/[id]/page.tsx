"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/auth";

interface Member {
  id: string;
  email: string | null;
  role: "teacher" | "leader" | "student";
  status: string;
}

interface Reading {
  id: string;
  title: string;
  raw_text: string;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
}

interface Material {
  id: string;
  title: string | null;
  raw_text: string;
}

const ROLE_LABEL: Record<string, string> = {
  teacher: "教师",
  leader: "班委",
  student: "学生",
};

function readingStatus(r: Reading): { text: string; cls: string } {
  const now = Date.now();
  const start = new Date(r.starts_at).getTime();
  const end = r.ends_at ? new Date(r.ends_at).getTime() : Infinity;
  if (now < start) return { text: "未开始", cls: "bg-zinc-100 text-zinc-500" };
  if (now > end) return { text: "已截止", cls: "bg-red-100 text-red-600" };
  return { text: "进行中", cls: "bg-emerald-100 text-emerald-700" };
}

export default function ClassroomDetailPage() {
  const params = useParams<{ id: string }>();
  const [classroom, setClassroom] = useState<{ name: string; invite_code: string } | null>(null);
  const [myRole, setMyRole] = useState<"teacher" | "leader" | "student">("student");
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<Member[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [showPublish, setShowPublish] = useState(false);
  const [pTitle, setPTitle] = useState("");
  const [pText, setPText] = useState("");
  const [pStart, setPStart] = useState("");
  const [pEnd, setPEnd] = useState("");
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    apiFetch(`/api/classrooms/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        setClassroom(d.classroom);
        setMyRole(d.my_role);
        setMembers(d.members ?? []);
        setPending(d.pending ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));

    apiFetch(`/api/classrooms/${params.id}/readings`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setReadings(d.readings ?? []);
      })
      .catch(() => {});

    apiFetch("/api/materials")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setMaterials(d.materials ?? []);
      })
      .catch(() => {});
  }, [params.id, reloadKey]);

  async function approve(memberId: string) {
    const res = await apiFetch(`/api/classrooms/${params.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "审批失败");
    else load();
  }

  async function promote(memberId: string, role: "leader" | "teacher") {
    const res = await apiFetch(`/api/classrooms/${params.id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId, role }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "操作失败");
    else load();
  }

  async function pickMaterial(id: string) {
    const res = await apiFetch(`/api/materials/${id}`);
    const d = await res.json();
    if (res.ok && d.material) {
      setPTitle(d.material.title ?? "");
      setPText(d.material.raw_text ?? "");
    }
  }

  async function publish() {
    if (!pTitle.trim() || !pText.trim() || !pEnd) {
      setError("请填写标题、正文和截止时间");
      return;
    }
    setPublishing(true);
    setError("");
    try {
      const res = await apiFetch(`/api/classrooms/${params.id}/readings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pTitle.trim(),
          text: pText.trim(),
          starts_at: pStart,
          ends_at: pEnd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "发布失败");
      setShowPublish(false);
      setPTitle("");
      setPText("");
      setPStart("");
      setPEnd("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link href="/teaching" className="text-sm text-zinc-500 hover:text-orange-600">
        ← 返回教学模式
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          {classroom?.name ?? "班级"}
        </h1>
        {(myRole === "teacher" || myRole === "leader") && classroom && (
          <span className="rounded-lg bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700">
            邀请码：<span className="font-mono font-bold">{classroom.invite_code}</span>
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 必读文章 */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">必读文章</h2>
          {(myRole === "teacher" || myRole === "leader") && (
            <button
              onClick={() => setShowPublish(!showPublish)}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              {showPublish ? "收起" : "发布文章"}
            </button>
          )}
        </div>

        {(myRole === "teacher" || myRole === "leader") && showPublish && (
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
              <label className="text-xs text-zinc-600">
                开始时间
                <input
                  type="datetime-local"
                  value={pStart}
                  onChange={(e) => setPStart(e.target.value)}
                  className="ml-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-zinc-600">
                截止时间
                <input
                  type="datetime-local"
                  value={pEnd}
                  onChange={(e) => setPEnd(e.target.value)}
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
          {readings.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-zinc-400">
              还没有必读文章
            </div>
          )}
          {readings.map((r) => {
            const s = readingStatus(r);
            return (
              <Link
                key={r.id}
                href={`/teaching/${params.id}/readings/${r.id}`}
                className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white p-4 transition hover:shadow-md"
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900">{r.title}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {r.ends_at
                      ? `截止 ${new Date(r.ends_at).toLocaleString("zh-CN")}`
                      : "长期有效"}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
                  {s.text}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 待审批 */}
      {(myRole === "teacher" || myRole === "leader") && pending.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-900">待审批申请</h2>
          <div className="mt-3 space-y-2">
            {pending.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white p-4"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-800">{m.email}</p>
                  <p className="text-xs text-zinc-400">
                    申请成为{ROLE_LABEL[m.role] ?? m.role}
                  </p>
                </div>
                <button
                  onClick={() => approve(m.id)}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                >
                  通过
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 成员 */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">成员</h2>
        <div className="mt-3 space-y-2">
          {members.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-200 p-10 text-center text-zinc-400">
              暂无成员
            </div>
          )}
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white p-4"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    m.role === "teacher"
                      ? "bg-orange-100 text-orange-700"
                      : m.role === "leader"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {ROLE_LABEL[m.role] ?? m.role}
                </span>
                <p className="text-sm font-medium text-zinc-800">{m.email}</p>
              </div>
              {myRole === "teacher" && m.role === "student" && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => promote(m.id, "leader")}
                    className="text-xs font-medium text-emerald-700 hover:underline"
                  >
                    设为班委
                  </button>
                  <button
                    onClick={() => promote(m.id, "teacher")}
                    className="text-xs font-medium text-orange-700 hover:underline"
                  >
                    设为教师
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
