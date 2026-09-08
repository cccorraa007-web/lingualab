"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/auth";

interface WorkStat { user_id: string; email: string; submitted: number; total: number; on_time: number; done_readings: number; grade_distribution: Record<string, number>; }
interface LearningStat { user_id: string; email: string; self_reading_count: number; speaking_count: number; speaking_avg_score: number | null; speaking_avg_duration: number | null; speaking_last_7_days: number; writing_count: number; writing_avg_score: number | null; mistake_count: number; mistake_mastering: number; }
interface Analysis { type: "预习" | "课后作业"; title: string; summary: string; analyzed_at: string | null; }

export default function StudentProfilesPage() {
  const params = useParams<{ id: string }>();
  const [work, setWork] = useState<WorkStat[]>([]); const [learning, setLearning] = useState<LearningStat[]>([]); const [analyses, setAnalyses] = useState<Analysis[]>([]); const [error, setError] = useState("");
  useEffect(() => { Promise.all([
    apiFetch(`/api/classrooms/${params.id}/assignments/stats`).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    apiFetch(`/api/classrooms/${params.id}/assignments/student-profiles`).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
  ]).then(([stats, profiles]) => { setWork(stats.all_students ?? []); setAnalyses(stats.analyses ?? []); setLearning(profiles.profiles ?? []); }).catch((e) => setError(e instanceof Error ? e.message : "加载失败")); }, [params.id]);
  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6"><Link href={`/teaching/${params.id}/members`} className="text-sm text-zinc-500 hover:text-orange-600">← 返回班级成员</Link><h1 className="mt-3 text-3xl font-bold text-zinc-900">学生档案</h1><p className="mt-2 text-zinc-600">查看全班平时作业、课外学习和动态学情分析。</p>{error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</div>}
    <section className="mt-8"><h2 className="text-lg font-semibold">全班学生</h2><div className="mt-3 grid gap-4">{work.length === 0 ? <p className="text-zinc-400">暂无学生数据</p> : work.map((student) => { const extra = learning.find((item) => item.user_id === student.user_id); return <article key={student.user_id} className="rounded-2xl border border-zinc-100 bg-white p-5"><h3 className="font-semibold text-zinc-900">{student.email}</h3><div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><Stat label="平时作业" value={`${student.submitted}/${student.total}`} /><Stat label="预习完成" value={String(student.done_readings)} /><Stat label="按时提交" value={String(student.on_time)} /><Stat label="等级分布" value={Object.entries(student.grade_distribution).map(([g,c]) => `${g}×${c}`).join(" ") || "—"} /></div>{extra && <><div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><Stat label="自主阅读" value={`${extra.self_reading_count} 篇`} /><Stat label="口语练习" value={`${extra.speaking_count} 次`} /><Stat label="写作润色" value={`${extra.writing_count} 次`} /><Stat label="错题/掌握中" value={`${extra.mistake_count}/${extra.mistake_mastering}`} /></div><p className="mt-3 text-xs leading-6 text-zinc-500">近 7 天口语 {extra.speaking_last_7_days} 次 · 口语平均 {extra.speaking_avg_score ?? "—"} 分 / {extra.speaking_avg_duration ? `${Math.round(extra.speaking_avg_duration / 60)} 分钟` : "时长暂无"} · 写作平均 {extra.writing_avg_score ?? "—"} 分</p></>}</article>; })}</div></section>
    <section className="mt-8"><h2 className="text-lg font-semibold">学情分析统计</h2><p className="mt-1 text-xs text-zinc-400">实时读取已生成的预习与课后作业班级分析；学生继续作答后可在对应内容页重新生成。</p><div className="mt-3 space-y-3">{analyses.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-zinc-400">暂无班级分析</div> : analyses.map((item, index) => <div key={`${item.type}-${item.title}-${index}`} className="rounded-xl border border-zinc-100 bg-white p-5"><div className="flex items-center gap-2"><span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">{item.type}</span><p className="font-medium">{item.title}</p></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">{item.summary}</p></div>)}</div></section>
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-zinc-50 p-3"><p className="font-semibold text-orange-700">{value}</p><p className="mt-1 text-xs text-zinc-500">{label}</p></div>; }
