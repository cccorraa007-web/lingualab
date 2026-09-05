"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/auth";

interface Classroom {
  id: string;
  name: string;
  invite_code: string;
  my_role: "teacher" | "leader" | "student";
}

export default function TeachingPage() {
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [name, setName] = useState("");
  const [createRole, setCreateRole] = useState<"teacher" | "student">("teacher");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Classroom | null>(null);

  const [inviteCode, setInviteCode] = useState("");
  const [joinRole, setJoinRole] = useState<"teacher" | "student">("student");
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState("");

  useEffect(() => {
    apiFetch("/api/classrooms")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setClasses(d.classes ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [reloadKey]);

  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await apiFetch("/api/classrooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role: createRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      setCreated(data.classroom);
      setName("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin() {
    if (!inviteCode.trim()) return;
    setJoining(true);
    setError("");
    setJoinMsg("");
    try {
      const res = await apiFetch("/api/classrooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: inviteCode.trim(), role: joinRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加入失败");
      setJoinMsg(data.message);
      setInviteCode("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">教学模式</h1>
      <p className="mt-2 text-zinc-600">创建或加入班级，开始班级阅读与口语教学。</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="flex-1 rounded-xl border border-orange-200 bg-orange-50/40 p-4">
          <label className="text-sm font-semibold text-zinc-700">创建班级</label>
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => setCreateRole("teacher")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                createRole === "teacher"
                  ? "border-orange-400 bg-orange-600 text-white"
                  : "border-zinc-200 bg-white text-zinc-600"
              }`}
            >
              以教师身份
            </button>
            <button
              type="button"
              onClick={() => setCreateRole("student")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                createRole === "student"
                  ? "border-orange-400 bg-orange-600 text-white"
                  : "border-zinc-200 bg-white text-zinc-600"
              }`}
            >
              以学生身份
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="班级名称"
              className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {creating ? "创建中…" : "创建"}
            </button>
          </div>
          {created && (
            <p className="mt-2 text-sm text-emerald-600">
              班级「{created.name}」已创建，邀请码：{" "}
              <span className="font-mono font-bold">{created.invite_code}</span>
              （发给同学）
            </p>
          )}
        </div>

        <div className="flex-1 rounded-xl border border-zinc-200 bg-white p-4">
          <label className="text-sm font-semibold text-zinc-700">加入班级</label>
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => setJoinRole("teacher")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                joinRole === "teacher"
                  ? "border-orange-400 bg-orange-600 text-white"
                  : "border-zinc-200 text-zinc-600"
              }`}
            >
              以教师身份
            </button>
            <button
              type="button"
              onClick={() => setJoinRole("student")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                joinRole === "student"
                  ? "border-orange-400 bg-orange-600 text-white"
                  : "border-zinc-200 text-zinc-600"
              }`}
            >
              以学生身份
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="输入邀请码"
              className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
            <button
              onClick={handleJoin}
              disabled={joining || !inviteCode.trim()}
              className="rounded-lg border border-orange-300 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50"
            >
              {joining ? "加入中…" : "加入"}
            </button>
          </div>
          {joinMsg && <p className="mt-2 text-sm text-emerald-600">{joinMsg}</p>}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">我的班级</h2>
      <div className="mt-3 space-y-3">
        {classes.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-200 p-10 text-center text-zinc-400">
            还没有加入任何班级
          </div>
        )}
        {classes.map((c) => (
          <Link
            key={c.id}
            href={`/teaching/${c.id}`}
            className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <div>
              <p className="font-semibold text-zinc-900">{c.name}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {c.my_role === "teacher"
                  ? "教师"
                  : c.my_role === "leader"
                    ? "班委"
                    : "学生"}
              </p>
            </div>
            <span className="text-sm text-orange-600">进入 →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
