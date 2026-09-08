"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/auth";

interface LibraryItem {
  id: string;
  source: "material" | "reading" | "assignment";
  source_id: string;
  title: string;
  created_at: string;
}

interface Annotation {
  id: string;
  text: string;
  color: string;
  note: string | null;
}

interface StudentAnnotation {
  email: string;
  text: string;
  note: string | null;
}

interface Question {
  id: string;
  sentence: string;
  question: string;
}

interface Answer {
  id: string;
  question_id: string;
  email: string | null;
  answer: string;
  feedback: string | null;
}

interface ReadingData {
  reading: {
    title: string;
    class_summary: string | null;
    class_analysis_at: string | null;
  };
  annotations: Annotation[];
  student_annotations: StudentAnnotation[];
  questions: Question[];
  answers: Answer[];
}

interface AssignmentData {
  assignment: { title: string; content: string; class_summary: string | null; class_analysis_at: string | null };
  recipients: { user_id: string; email: string | null }[];
  submissions: { id: string; user_id: string; content: string | null; ocr_text: string | null; feedback: string | null; grade: string | null }[];
}

export default function LibraryItemDetailPage() {
  const params = useParams<{ id: string; itemId: string }>();
  const [item, setItem] = useState<LibraryItem | null>(null);
  const [readingData, setReadingData] = useState<ReadingData | null>(null);
  const [assignmentData, setAssignmentData] = useState<AssignmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/api/classrooms/${params.id}/library/items/${params.itemId}`)
      .then((r) => r.json())
      .then(async (d) => {
        if (d.error) throw new Error(d.error);
        setItem(d.item);
        if (d.item.source === "reading") {
          const res = await apiFetch(
            `/api/classrooms/${params.id}/readings/${d.item.source_id}`,
          );
          const rd = await res.json();
          if (rd.error) throw new Error(rd.error);
          setReadingData(rd);
        } else if (d.item.source === "assignment") {
          const res = await apiFetch(`/api/classrooms/${params.id}/assignments/${d.item.source_id}`);
          const ad = await res.json();
          if (ad.error) throw new Error(ad.error);
          setAssignmentData(ad);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [params.id, params.itemId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-zinc-400">
        加载中…
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-zinc-400">
        {error || "记录不存在"}
      </div>
    );
  }

  const isReading = item.source === "reading";
  const isAssignment = item.source === "assignment";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href={`/teaching/${params.id}/speaking`}
        className="text-sm text-zinc-500 hover:text-orange-600"
      >
        ← 返回备课资料库
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            {item.title}
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            {new Date(item.created_at).toLocaleString("zh-CN")}
          </p>
        </div>
      </div>

      {isReading && readingData ? (
        <div className="mt-6 space-y-8">
          {/* 老师批注 */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">老师自己的批注</h2>
            <div className="mt-3 space-y-2">
              {readingData.annotations.length === 0 ? (
                <p className="text-sm text-zinc-400">暂无批注</p>
              ) : (
                readingData.annotations.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-2 rounded-lg border border-zinc-100 bg-white p-3"
                  >
                    <span className="rounded bg-yellow-200 px-1.5 py-0.5 text-sm font-medium">
                      {a.text}
                    </span>
                    {a.note && (
                      <span className="flex-1 text-sm text-zinc-600">{a.note}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 学生作答情况 */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">学生作答情况</h2>
            <div className="mt-3 space-y-2">
              {readingData.questions.length === 0 ? (
                <p className="text-sm text-zinc-400">暂无题目与作答</p>
              ) : (
                readingData.questions.map((q) => {
                  const qAnswers = readingData.answers.filter(
                    (a) => a.question_id === q.id,
                  );
                  return (
                    <div
                      key={q.id}
                      className="rounded-xl border border-zinc-100 bg-white p-4"
                    >
                      <p className="text-sm font-medium text-zinc-800">
                        {q.question}
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {qAnswers.length === 0 ? (
                          <p className="text-xs text-zinc-400">暂无学生作答</p>
                        ) : (
                          qAnswers.map((a) => (
                            <div
                              key={a.id}
                              className="rounded-lg bg-zinc-50 p-2 text-sm"
                            >
                              <span className="font-medium text-zinc-600">
                                {a.email || "学生"}：
                              </span>
                              <span className="text-zinc-700">{a.answer}</span>
                              {a.feedback && (
                                <span className="ml-1 text-xs text-emerald-600">
                                  （批注：{a.feedback}）
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* 学生提问 */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">每个学生提的问题</h2>
            <div className="mt-3 space-y-2">
              {readingData.student_annotations.length === 0 ? (
                <p className="text-sm text-zinc-400">暂无学生提问</p>
              ) : (
                readingData.student_annotations.map((sa, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-zinc-100 bg-white p-3"
                  >
                    <span className="rounded bg-blue-200 px-1.5 py-0.5 text-sm font-medium">
                      {sa.text}
                    </span>
                    <span className="text-xs font-medium text-zinc-500">
                      {sa.email}
                    </span>
                    {sa.note && (
                      <span className="flex-1 text-sm text-zinc-600">{sa.note}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 班级作答分析 */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">班级作答分析</h2>
            {readingData.reading.class_summary ? (
              <p className="mt-3 rounded-xl border border-orange-100 bg-orange-50/40 p-4 text-sm leading-6 text-zinc-700">
                {readingData.reading.class_summary}
              </p>
            ) : (
              <p className="mt-3 text-sm text-zinc-400">尚未生成班级作答分析。</p>
            )}
            <Link
              href={`/teaching/${params.id}/readings/${item.source_id}/analysis`}
              className="mt-2 inline-block text-sm text-orange-600 hover:underline"
            >
              查看/生成完整分析 →
            </Link>
          </section>
        </div>
      ) : isAssignment && assignmentData ? (
        <div className="mt-6 space-y-8">
          <section><h2 className="text-lg font-semibold text-zinc-900">作业要求</h2><p className="mt-3 whitespace-pre-wrap rounded-xl border border-zinc-100 bg-white p-4 text-sm leading-6 text-zinc-700">{assignmentData.assignment.content}</p></section>
          <section><h2 className="text-lg font-semibold text-zinc-900">学生最新提交与批改</h2><div className="mt-3 space-y-3">{assignmentData.submissions.length === 0 ? <p className="text-sm text-zinc-400">暂无提交</p> : assignmentData.submissions.map((submission) => { const email = assignmentData.recipients.find((r) => r.user_id === submission.user_id)?.email || submission.user_id; return <div key={submission.id} className="rounded-xl border border-zinc-100 bg-white p-4"><div className="flex justify-between gap-3"><p className="font-medium text-zinc-800">{email}</p><span className="text-xs text-orange-700">{submission.grade || "未评分"}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">{[submission.content, submission.ocr_text].filter(Boolean).join("\n\n") || "无文字内容"}</p>{submission.feedback && <p className="mt-2 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">教师反馈：{submission.feedback}</p>}</div>; })}</div></section>
          <section><h2 className="text-lg font-semibold text-zinc-900">班级作答分析</h2>{assignmentData.assignment.class_summary ? <p className="mt-3 whitespace-pre-wrap rounded-xl border border-orange-100 bg-orange-50/40 p-4 text-sm leading-6 text-zinc-700">{assignmentData.assignment.class_summary}</p> : <p className="mt-3 text-sm text-zinc-400">尚未生成班级作答分析。</p>}<Link href={`/teaching/${params.id}/assignments/${item.source_id}/analysis`} className="mt-2 inline-block text-sm text-orange-600 hover:underline">查看/重新生成分析 →</Link></section>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-200 p-10 text-center text-sm text-zinc-400">
          该素材类型暂无详细教学数据，可返回「备课资料库」生成课件。
        </div>
      )}

    </div>
  );
}
