"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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

export default function AnswerGradingPage() {
  const params = useParams<{
    id: string;
    readingId: string;
    questionId: string;
    answerId: string;
  }>();
  const router = useRouter();

  const [question, setQuestion] = useState<Question | null>(null);
  const [myRole, setMyRole] = useState<"teacher" | "student">("student");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
        setMyRole(d.my_role === "teacher" ? "teacher" : "student");
        const found = (d.answers ?? []).find(
          (a: Answer) => a.id === params.answerId,
        );
        setAnswer(found ?? null);
        setFeedback(found?.feedback ?? "");
        setError("");
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, params.readingId, params.questionId, params.answerId]);

  async function save() {
    const fb = feedback.trim();
    if (!fb) {
      setError("批注不能为空");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(
        `/api/classrooms/${params.id}/readings/${params.readingId}/questions/${params.questionId}/answers/${params.answerId}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: fb }),
        },
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "保存失败");
      router.push(
        `/teaching/${params.id}/readings/${params.readingId}/questions/${params.questionId}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (!answer) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-zinc-400">
        {error || "加载中…"}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href={`/teaching/${params.id}/readings/${params.readingId}/questions/${params.questionId}`}
        className="text-sm text-zinc-500 hover:text-orange-600"
      >
        ← 返回题目
      </Link>

      <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">
        学生作答
      </h1>

      {question && (
        <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50/40 p-4">
          <p className="text-sm text-zinc-500">{question.sentence}</p>
          <p className="mt-1 text-base font-medium text-zinc-900">
            {question.question}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-zinc-100 bg-white p-5">
        <p className="text-sm font-semibold text-zinc-700">
          {answer.email || "学生"}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-800">
          {answer.answer}
        </p>
      </div>

      {myRole === "teacher" ? (
        <div className="mt-4 rounded-xl border border-zinc-100 bg-white p-5">
          <p className="text-sm font-semibold text-zinc-700">教师批注</p>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="写批改留言…"
            rows={4}
            className="mt-2 w-full rounded-lg border border-zinc-200 p-3 text-sm outline-none focus:border-orange-400"
          />
          <button
            onClick={save}
            disabled={saving}
            className="mt-2 rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存批注"}
          </button>
        </div>
      ) : (
        answer.feedback && (
          <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            教师批注：{answer.feedback}
          </div>
        )
      )}
    </div>
  );
}
