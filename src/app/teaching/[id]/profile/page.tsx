"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/auth";

interface Member {
  id: string;
  email: string | null;
  role: string;
}

interface Assignment {
  id: string;
  title: string;
  ends_at: string;
}

interface Submission {
  assignment_id: string;
  submitted_at: string;
  feedback: string | null;
  score: number | null;
  graded_at: string | null;
}

interface Reading {
  id: string;
  title: string;
  question_count?: number;
  answered_count?: number;
  done?: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  teacher: "教师",
  student: "学生",
};

export default function ClassroomProfilePage() {
  const params = useParams<{ id: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch(`/api/classrooms/${params.id}`).then((r) => r.json()),
      apiFetch(`/api/classrooms/${params.id}/assignments`).then((r) => r.json()),
      apiFetch(`/api/classrooms/${params.id}/readings`).then((r) => r.json()),
    ])
      .then(([cls, asg, rdg]) => {
        setMembers(cls.members ?? []);
        setAssignments(asg.assignments ?? []);
        setSubmissions(asg.submissions ?? []);
        setReadings(rdg.readings ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [params.id]);

  const submissionByAssignment = new Map(
    submissions.map((s) => [s.assignment_id, s]),
  );

  const totalAssignments = assignments.length;
  const submitted = assignments.filter((a) =>
    submissionByAssignment.has(a.id),
  ).length;
  const graded = assignments.filter((a) => {
    const s = submissionByAssignment.get(a.id);
    return s && (s.feedback != null || s.score != null);
  }).length;
  const onTime = assignments.filter((a) => {
    const s = submissionByAssignment.get(a.id);
    if (!s) return false;
    return new Date(s.submitted_at).getTime() <= new Date(a.ends_at).getTime();
  }).length;
  const scores = assignments
    .map((a) => submissionByAssignment.get(a.id)?.score)
    .filter((s): s is number => typeof s === "number");
  const averageScore =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null;

  const totalReadings = readings.length;
  const doneReadings = readings.filter((r) => r.done).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href={`/teaching/${params.id}`}
        className="text-sm text-zinc-500 hover:text-orange-600"
      >
        ← 返回班级
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
        我的档案
      </h1>
      <p className="mt-2 text-zinc-600">
        追踪自己在班级里的学习与作业完成情况。
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
          {/* 评分统计仪表盘 */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">作业评分统计</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="已提交作业" value={`${submitted}/${totalAssignments}`} />
              <StatCard label="按时提交" value={`${onTime}`} />
              <StatCard label="已批改" value={`${graded}`} />
              <StatCard
                label="平均分"
                value={averageScore != null ? String(averageScore) : "—"}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="必读文章" value={`${doneReadings}/${totalReadings}`} />
              <StatCard label="阅读已完成" value={`${doneReadings}`} />
            </div>
          </section>

          {/* 班级综合排行 */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">班级综合排行</h2>
            <div className="mt-3 rounded-xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-400">
              班级综合排行前三即将上线（由笔头作业模块提供数据）。
            </div>
          </section>

          {/* 我的作业提交情况 */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">我的作业提交情况</h2>
            <div className="mt-3 space-y-2">
              {assignments.length === 0 ? (
                <p className="text-sm text-zinc-400">暂无笔头作业</p>
              ) : (
                assignments.map((a) => {
                  const s = submissionByAssignment.get(a.id);
                  const late =
                    s &&
                    new Date(s.submitted_at).getTime() >
                      new Date(a.ends_at).getTime();
                  const graded = s && (s.feedback != null || s.score != null);
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-900">
                          {a.title}
                        </p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {s
                            ? `提交于 ${new Date(s.submitted_at).toLocaleString("zh-CN")}`
                            : "未提交"}
                        </p>
                      </div>
                      <div className="ml-4 flex shrink-0 items-center gap-2">
                        {s ? (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              late
                                ? "bg-red-100 text-red-600"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {late ? "迟交" : "按时"}
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-500">
                            未交
                          </span>
                        )}
                        {graded ? (
                          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                            {s?.score != null ? `评分 ${s.score}` : "已批改"}
                          </span>
                        ) : (
                          s && (
                            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-500">
                              待批改
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* 班级成员 */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">班级成员</h2>
            <div className="mt-3 space-y-2">
              {members.length === 0 ? (
                <p className="text-sm text-zinc-400">暂无成员</p>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          m.role === "teacher"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                      <p className="text-sm font-medium text-zinc-800">
                        {m.email}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-4 text-center">
      <p className="text-2xl font-bold text-orange-600">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}
