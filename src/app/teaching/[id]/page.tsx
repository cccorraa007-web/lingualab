"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/auth";
import { langMeta } from "@/lib/language";

const TEACHER_CARDS = [
  {
    href: "members",
    title: "班级成员",
    desc: "管理成员，审批加入申请，指定教师。",
    emoji: "👥",
  },
  {
    href: "assignments",
    title: "布置作业",
    desc: "发布课前预习与课后作业，追踪作业收发与平时成绩。",
    emoji: "📝",
  },
  {
    href: "speaking",
    title: "备课资料库",
    desc: "从语料库、必读文章、笔头作业导入素材，基于全部素材一键生成课件。",
    emoji: "📚",
  },
];

const STUDENT_CARDS = [
  {
    href: "profile",
    title: "我的档案",
    desc: "查看班级成员、我的作业提交情况与评分统计。",
    emoji: "📊",
  },
  {
    href: "assignments",
    title: "课后作业",
    desc: "查看待完成的必读文章与笔头作业。",
    emoji: "📝",
  },
  {
    href: "/practice",
    title: "课外练习",
    desc: "前往自学模式，进行口语、写作、错题等练习。",
    emoji: "🎤",
    external: true,
  },
];

export default function ClassroomDashboardPage() {
  const params = useParams<{ id: string }>();
  const [classroom, setClassroom] = useState<{
    name: string;
    invite_code: string;
    lang?: string;
  } | null>(null);
  const [myRole, setMyRole] = useState("student");
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
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
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));

    apiFetch(`/api/classrooms/${params.id}/readings`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return;
        const now = Date.now();
        const pending = (d.readings ?? []).filter(
          (r: {
            starts_at: string;
            ends_at: string | null;
            done?: boolean;
          }) => {
            const start = new Date(r.starts_at).getTime();
            const end = r.ends_at ? new Date(r.ends_at).getTime() : Infinity;
            if (now < start || now > end) return false;
            return r.done === false;
          },
        ).length;
        setPendingCount(pending);
      })
      .catch(() => {});
  }, [params.id]);

  const isTeacher = myRole === "teacher";
  const cards = isTeacher ? TEACHER_CARDS : STUDENT_CARDS;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href="/teaching"
        className="text-sm text-zinc-500 hover:text-orange-600"
      >
        ← 返回课堂模式
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          {classroom?.name ?? "班级"}
        </h1>
        {(classroom?.lang === "es" || classroom?.lang === "en") && (
          <span className="rounded-lg bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
            {langMeta(classroom.lang).label}
          </span>
        )}
        {isTeacher && classroom && (
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

      {loading ? (
        <div className="mt-8 text-center text-zinc-400">加载中…</div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={
                (c as { external?: boolean }).external
                  ? c.href
                  : `/teaching/${params.id}/${c.href}`
              }
              className="group relative rounded-2xl border border-zinc-100 bg-white p-6 text-center shadow-sm transition hover:shadow-md"
            >
              {c.href === "assignments" && !isTeacher && pendingCount > 0 && (
                <span className="absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                  {pendingCount}
                </span>
              )}
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
      )}
    </div>
  );
}
