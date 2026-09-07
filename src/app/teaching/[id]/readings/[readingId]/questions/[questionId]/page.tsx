"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/auth";

interface Question {
  id: string;
  sentence: string;
  question: string;
}

interface Answer {
  id: string;
  user_id: string;
  email: string | null;
  answer: string;
  feedback: string | null;
  graded_at: string | null;
}

interface Student {
  user_id: string;
  email: string | null;
}

export default function QuestionDetailPage() {
  const params = useParams<{
    id: string;
    readingId: string;
    questionId: string;
  }>();

  const [question, setQuestion] = useState<Question | null>(null);
  const [readingTitle, setReadingTitle] = useState("");
  const [myRole, setMyRole] = useState<"teacher" | "student">("student");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [myAnswer, setMyAnswer] = useState<Answer | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    apiFetch(
      `/api/classrooms/${params.id}/readings/${params.readingId}/questions/${params.questionId}`,
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "加载失败");
        return d;
      })
      .then((d) => {
        if (cancelled) return;
        setQuestion(d.question);
        setReadingTitle(d.reading_title ?? "");
        setMyRole(d.my_role === "teacher" ? "teacher" : "student");
        setAnswers(d.answers ?? []);
        setStudents(d.students ?? []);
        setMyAnswer(d.my_answer ?? null);
        setDraft((cur) => (cur === "" ? d.my_answer?.answer ?? "" : cur));
        setError("");
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, params.readingId, params.questionId, reloadKey]);

  async function submit() {
    const answer = draft.trim();
    if (!answer) {
      setError("答案不能为空");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await apiFetch(
        `/api/classrooms/${params.id}/readings/${params.readingId}/questions/${params.questionId}/answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer }),
        },
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "提交失败");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (!question) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-zinc-400">
        {error || "加载中…"}
      </div>
    );
  }

  const isTeacher = myRole === "teacher";
  const answeredIds = new Set(answers.map((a) => a.user_id));
  const unanswered = students.filter((s) => !answeredIds.has(s.user_id));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href={`/teaching/${params.id}/readings/${params.readingId}`}
        className="text-sm text-zinc-500 hover:text-orange-600"
      >
        ← 返回{readingTitle ? `《${readingTitle}》` : "文章"}
      </Link>

      <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50/40 p-5">
        <p className="text-sm text-zinc-500">{question.sentence}</p>
        <p className="mt-2 text-lg font-medium text-zinc-900">
          {question.question}
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isTeacher ? (
        <div className="mt-6 space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">
              已作答学生（{answers.length}）
            </h2>
            <div className="mt-3 space-y-2">
              {answers.length === 0 && (
                <p className="text-sm text-zinc-400">暂无学生作答</p>
              )}
              {answers.map((a) => (
                <Link
                  key={a.id}
                  href={`/teaching/${params.id}/readings/${params.readingId}/questions/${params.questionId}/answers/${a.id}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white p-4 transition hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900">
                      {a.email || "学生"}
                    </p>
                    <p className="mt-1 truncate text-sm text-zinc-500">
                      {a.answer}
                    </p>
                  </div>
                  <span
                    className={`ml-4 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      a.feedback
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {a.feedback ? "已批改" : "未批改"}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {unanswered.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-zinc-900">
                未作答学生（{unanswered.length}）
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {unanswered.map((s) => (
                  <span
                    key={s.user_id}
                    className="rounded-full bg-red-50 px-3 py-1 text-sm text-red-600"
                  >
                    {s.email || "学生"}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="mt-6">
          {myAnswer ? (
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
              <p className="text-xs text-zinc-400">我的答案</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">
                {myAnswer.answer}
              </p>
              {myAnswer.feedback ? (
                <p className="mt-3 rounded bg-emerald-50 px-2 py-1 text-sm text-emerald-700">
                  教师批注：{myAnswer.feedback}
                </p>
              ) : (
                <p className="mt-2 text-xs text-zinc-400">等待教师批改…</p>
              )}
            </div>
          ) : null}

          <p className="mt-4 text-sm font-medium text-zinc-700">
            {myAnswer ? "修改答案" : "作答"}
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="写下你的答案…"
            rows={5}
            className="mt-2 w-full rounded-lg border border-zinc-200 p-3 text-sm outline-none focus:border-orange-400"
          />
          <button
            onClick={submit}
            disabled={submitting}
            className="mt-2 rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {submitting ? "提交中…" : myAnswer ? "更新答案" : "提交答案"}
          </button>
        </div>
      )}
    </div>
  );
}
