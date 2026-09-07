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

const LESSON_TYPES = [
  { value: "blank", label: "填空题" },
  { value: "choice", label: "选择题" },
  { value: "truefalse", label: "判断题" },
  { value: "qa", label: "问答题" },
];

export default function LibraryItemDetailPage() {
  const params = useParams<{ id: string; itemId: string }>();
  const [item, setItem] = useState<LibraryItem | null>(null);
  const [readingData, setReadingData] = useState<ReadingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [format, setFormat] = useState<"pptx" | "docx">("pptx");
  const [types, setTypes] = useState<string[]>(["blank", "choice"]);
  const [count, setCount] = useState(10);
  const [wordExplanation, setWordExplanation] = useState(false);
  const [extra, setExtra] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    filename: string;
    dataUrl: string;
  } | null>(null);
  const [genError, setGenError] = useState("");

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
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [params.id, params.itemId]);

  function toggleType(t: string) {
    setTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  async function generate() {
    if (!item) return;
    if (types.length === 0) {
      setGenError("请至少选择一种题型");
      return;
    }
    setGenerating(true);
    setGenError("");
    setResult(null);
    try {
      const url =
        item.source === "reading"
          ? `/api/classrooms/${params.id}/readings/${item.source_id}/lesson`
          : `/api/classrooms/${params.id}/library`;
      const body =
        item.source === "reading"
          ? {
              format,
              questionTypes: types,
              questionCount: count,
              extra,
              wordExplanation,
            }
          : {
              items: [{ source: item.source, id: item.source_id }],
              format,
              questionTypes: types,
              questionCount: count,
              extra,
              wordExplanation,
            };
      const res = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成失败");
      setResult({ filename: data.filename, dataUrl: data.dataUrl });
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

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
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          去备课（生成课件）
        </button>
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
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-200 p-10 text-center text-sm text-zinc-400">
          该素材类型暂无详细教学数据，可直接「去备课」生成课件。
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900">生成课件</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                关闭
              </button>
            </div>

            {result ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-medium text-emerald-700">课件已生成</p>
                <p className="mt-1 break-all text-xs text-zinc-500">
                  {result.filename}
                </p>
                <a
                  href={result.dataUrl}
                  download={result.filename}
                  className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  下载课件
                </a>
                <button
                  onClick={() => {
                    setResult(null);
                    setShowModal(false);
                  }}
                  className="ml-2 text-sm text-zinc-500 hover:text-zinc-700"
                >
                  完成
                </button>
              </div>
            ) : (
              <>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-zinc-700">文件格式</p>
                  <div className="mt-2 flex gap-2">
                    {(["pptx", "docx"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormat(f)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                          format === f
                            ? "border-orange-500 bg-orange-50 text-orange-700"
                            : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        {f === "pptx" ? "PPT 演示文稿" : "Word 文档"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-zinc-700">包含题型</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {LESSON_TYPES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => toggleType(t.value)}
                        className={`rounded-lg border px-3 py-1.5 text-sm ${
                          types.includes(t.value)
                            ? "border-orange-500 bg-orange-50 text-orange-700"
                            : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-zinc-700">题目数量</p>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value) || 1)}
                    className="mt-2 w-28 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                  />
                </div>

                <label className="mt-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={wordExplanation}
                    onChange={(e) => setWordExplanation(e.target.checked)}
                    className="h-4 w-4 accent-orange-600"
                  />
                  <span className="text-sm font-semibold text-zinc-700">
                    需要单词讲解
                  </span>
                </label>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-zinc-700">
                    补充需求（可选）
                  </p>
                  <textarea
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                    placeholder="例如：侧重语法点、加入课堂讨论环节…"
                    rows={3}
                    className="mt-2 w-full rounded-lg border border-zinc-200 p-2 text-sm outline-none focus:border-orange-400"
                  />
                </div>

                {genError && (
                  <p className="mt-3 text-sm text-red-600">{genError}</p>
                )}

                <button
                  onClick={generate}
                  disabled={generating}
                  className="mt-4 w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {generating ? "AI 生成中…（可能需要一段时间）" : "生成课件"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
