"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/auth";

interface StudentStatus {
  email: string;
  summary: string;
}

interface ReadingAnalysis {
  classSummary: string;
  students: StudentStatus[];
}

export default function ReadingAnalysisPage() {
  const params = useParams<{ id: string; readingId: string }>();

  const [analysis, setAnalysis] = useState<ReadingAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(
        `/api/classrooms/${params.id}/readings/${params.readingId}/analysis`,
        { method: "POST" },
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "分析失败");
      setAnalysis(d.analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href={`/teaching/${params.id}/readings/${params.readingId}`}
        className="text-sm text-zinc-500 hover:text-orange-600"
      >
        ← 返回文章
      </Link>

      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">班级作答分析</h1>
        {!analysis && (
          <button
            onClick={generate}
            disabled={loading}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? "分析中…" : "生成分析"}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {analysis && (
        <div className="mt-6 space-y-6">
          <section className="rounded-xl border border-orange-100 bg-orange-50/40 p-5">
            <h2 className="text-sm font-semibold text-zinc-700">
              班级总体情况
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
              {analysis.classSummary || "暂无总体分析"}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">
              各学生阅读情况（{analysis.students.length}）
            </h2>
            <div className="mt-3 space-y-3">
              {analysis.students.length === 0 && (
                <p className="text-sm text-zinc-400">暂无学生数据</p>
              )}
              {analysis.students.map((s) => (
                <div
                  key={s.email}
                  className="rounded-xl border border-zinc-100 bg-white p-4"
                >
                  <p className="font-medium text-zinc-900">{s.email}</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                    {s.summary || "暂无情况说明"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <button
            onClick={generate}
            disabled={loading}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {loading ? "重新分析中…" : "重新分析"}
          </button>
        </div>
      )}
    </div>
  );
}
