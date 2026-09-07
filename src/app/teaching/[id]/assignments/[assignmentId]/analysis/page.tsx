"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/auth";

interface Analysis { classSummary: string; students: { email: string; summary: string }[]; }

export default function AssignmentAnalysisPage() {
  const params = useParams<{ id: string; assignmentId: string }>();
  const [analysis, setAnalysis] = useState<Analysis | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { apiFetch(`/api/classrooms/${params.id}/assignments/${params.assignmentId}/analysis`, { method: "POST" }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "分析失败"); setAnalysis(data.analysis); }).catch((e) => setError(e instanceof Error ? e.message : "分析失败")).finally(() => setLoading(false)); }, [params.id, params.assignmentId]);
  return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6"><Link href={`/teaching/${params.id}/assignments/${params.assignmentId}`} className="text-sm text-zinc-500 hover:text-orange-600">← 返回作业详情</Link><h1 className="mt-3 text-3xl font-bold text-zinc-900">班级作答分析</h1>{loading && <p className="mt-8 text-zinc-400">AI 正在分析本次作业…</p>}{error && <div className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}{analysis && <div className="mt-6 space-y-5"><section className="rounded-2xl border border-orange-100 bg-orange-50/40 p-6"><h2 className="font-semibold text-orange-800">班级总体情况</h2><p className="mt-3 whitespace-pre-wrap leading-7 text-zinc-700">{analysis.classSummary}</p></section><section><h2 className="text-lg font-semibold">学生情况</h2><div className="mt-3 space-y-3">{analysis.students.map((student) => <div key={student.email} className="rounded-xl border border-zinc-100 bg-white p-5"><p className="font-medium text-zinc-900">{student.email}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">{student.summary}</p></div>)}</div></section></div>}</div>;
}
