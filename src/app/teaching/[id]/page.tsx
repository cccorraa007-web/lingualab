"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/auth";

const CARDS = [
  {
    href: "members",
    title: "班级成员",
    desc: "管理班级成员，审批加入申请，指定班委与教师。",
    emoji: "👥",
  },
  {
    href: "assignments",
    title: "发布作业",
    desc: "发布必读文章与笔头作业，设置截止时间，查看提交与批改。",
    emoji: "📝",
  },
  {
    href: "speaking",
    title: "口语练习",
    desc: "围绕语料开展口语训练，AI 生成问题并记录表现。（建设中）",
    emoji: "🎤",
  },
];

export default function ClassroomDashboardPage() {
  const params = useParams<{ id: string }>();
  const [classroom, setClassroom] = useState<{
    name: string;
    invite_code: string;
  } | null>(null);
  const [myRole, setMyRole] = useState("student");
  const [error, setError] = useState("");

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
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [params.id]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href="/teaching"
        className="text-sm text-zinc-500 hover:text-orange-600"
      >
        ← 返回教学模式
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          {classroom?.name ?? "班级"}
        </h1>
        {(myRole === "teacher" || myRole === "leader") && classroom && (
          <span className="rounded-lg bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700">
            邀请码：
            <span className="font-mono font-bold">{classroom.invite_code}</span>
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={`/teaching/${params.id}/${c.href}`}
            className="group rounded-2xl border border-zinc-100 bg-white p-6 text-center shadow-sm transition hover:shadow-md"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-2xl">
              {c.emoji}
            </div>
            <h2 className="mt-4 text-lg font-semibold text-zinc-900">
              {c.title}
            </h2>
            <p className="mt-2 text-sm text-zinc-500">{c.desc}</p>
            <span className="mt-4 inline-block text-sm font-medium text-orange-600 group-hover:text-orange-700">
              进入 →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
