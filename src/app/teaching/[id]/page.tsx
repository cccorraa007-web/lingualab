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

const ROLE_LABEL: Record<string, string> = {
  teacher: "教师",
  leader: "班委",
  student: "学生",
};

export default function ClassroomDetailPage() {
  const params = useParams<{ id: string }>();
  const [classroom, setClassroom] = useState<{ name: string; invite_code: string } | null>(null);
  const [myRole, setMyRole] = useState<"teacher" | "leader" | "student">("student");
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

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

  async function promote(memberId: string) {
    const res = await apiFetch(`/api/classrooms/${params.id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "指定班委失败");
    else load();
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
                <button
                  onClick={() => promote(m.id)}
                  className="text-xs font-medium text-emerald-700 hover:underline"
                >
                  设为班委
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
