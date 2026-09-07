"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/auth";

interface Reading {
  id: string;
  title: string;
  raw_text: string;
  starts_at: string;
  ends_at: string | null;
}

interface Annotation {
  id: string;
  text: string;
  color: string;
  note: string | null;
}

interface Question {
  id: string;
  sentence: string;
  question: string;
}

const ANNOTATION_BG: Record<string, string> = {
  yellow: "bg-yellow-200",
  red: "bg-red-200",
  blue: "bg-blue-200",
  green: "bg-green-200",
};

const HIGHLIGHT_COLORS = ["yellow", "red", "blue", "green"];

interface Rule {
  text: string;
  className: string;
  note?: string;
}

function buildRules(annotations: Annotation[], questions: Question[]): Rule[] {
  const rules: Rule[] = [];
  for (const a of annotations) {
    rules.push({
      text: a.text,
      className: `${ANNOTATION_BG[a.color] ?? "bg-yellow-200"} ${
        a.note ? "border-b-2 border-dashed border-zinc-500" : ""
      }`,
      note: a.note ?? undefined,
    });
  }
  for (const q of questions) {
    rules.push({
      text: q.sentence,
      className: "border-b-2 border-orange-400",
      note: q.question,
    });
  }
  return rules;
}

function renderParagraph(para: string, rules: Rule[]): ReactNode[] {
  const matches: { start: number; end: number; rule: Rule }[] = [];
  const lower = para.toLowerCase();
  for (const rule of rules) {
    const needle = rule.text.toLowerCase();
    if (!needle) continue;
    let idx = lower.indexOf(needle);
    while (idx !== -1) {
      matches.push({ start: idx, end: idx + rule.text.length, rule });
      idx = lower.indexOf(needle, idx + 1);
    }
  }
  matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const m of matches) {
    if (m.start < cursor) continue;
    if (m.start > cursor) nodes.push(para.slice(cursor, m.start));
    nodes.push(
      <mark
        key={key++}
        className={`rounded-sm px-0.5 ${m.rule.className}`}
        title={m.rule.note}
      >
        {para.slice(m.start, m.end)}
      </mark>,
    );
    cursor = m.end;
  }
  if (cursor < para.length) nodes.push(para.slice(cursor));
  return nodes;
}

interface ToolbarState {
  text: string;
  x: number;
  y: number;
}

export default function ReadingPage() {
  const params = useParams<{ id: string; readingId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prepMode = searchParams.get("prep") === "1";
  const [reading, setReading] = useState<Reading | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [myRole, setMyRole] = useState<string>("student");
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const [noteInput, setNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [questionInput, setQuestionInput] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [addingToCorpus, setAddingToCorpus] = useState(false);
  const [addedToCorpus, setAddedToCorpus] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [showLesson, setShowLesson] = useState(false);
  const [lessonFormat, setLessonFormat] = useState<"pptx" | "docx">("pptx");
  const [lessonTypes, setLessonTypes] = useState<string[]>(["blank", "choice"]);
  const [lessonCount, setLessonCount] = useState(10);
  const [lessonExtra, setLessonExtra] = useState("");
  const [lessonWordExplanation, setLessonWordExplanation] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lessonResult, setLessonResult] = useState<{
    filename: string;
    dataUrl: string;
  } | null>(null);
  const [lessonError, setLessonError] = useState("");

  const LESSON_TYPES = [
    { value: "blank", label: "填空题" },
    { value: "choice", label: "选择题" },
    { value: "truefalse", label: "判断题" },
    { value: "qa", label: "问答题" },
  ];

  useEffect(() => {
    apiFetch(`/api/classrooms/${params.id}/readings/${params.readingId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        setReading(d.reading);
        setAnnotations(d.annotations ?? []);
        setQuestions(d.questions ?? []);
        setAnsweredCount((d.answers ?? []).length);
        setMyRole(d.my_role ?? "student");
        setAddedToCorpus(d.added_to_corpus ?? false);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [params.id, params.readingId, reloadKey]);

  function handleMouseUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (!text) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setToolbar({ text, x: rect.left + rect.width / 2, y: rect.top });
    setNoteInput(false);
    setQuestionInput(false);
  }

  async function createAnnotation(color: string, note?: string) {
    if (!toolbar) return;
    try {
      const res = await apiFetch(
        `/api/classrooms/${params.id}/readings/${params.readingId}/annotations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: toolbar.text,
            color,
            note: note?.trim() || undefined,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setToolbar(null);
      setNoteInput(false);
      setNoteText("");
      window.getSelection()?.removeAllRanges();
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function addQuestion() {
    if (!toolbar || !questionText.trim()) return;
    try {
      const res = await apiFetch(
        `/api/classrooms/${params.id}/readings/${params.readingId}/questions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sentence: toolbar.text, question: questionText.trim() }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "添加题目失败");
      setToolbar(null);
      setQuestionInput(false);
      setQuestionText("");
      window.getSelection()?.removeAllRanges();
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function deleteQuestion(id: string) {
    try {
      await apiFetch(
        `/api/classrooms/${params.id}/readings/${params.readingId}/questions/${id}`,
        { method: "DELETE" },
      );
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function deleteAnnotation(id: string) {
    try {
      await apiFetch(
        `/api/classrooms/${params.id}/readings/${params.readingId}/annotations/${id}`,
        { method: "DELETE" },
      );
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function addToCorpus() {
    if (!reading) return;
    setAddingToCorpus(true);
    setError("");
    try {
      const res = await apiFetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "text",
          title: reading.title,
          text: reading.raw_text,
          reading_id: params.readingId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加入资料库失败");
      setAddedToCorpus(true);
      router.push(`/corpus/review/${data.materialId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAddingToCorpus(false);
    }
  }

  function toggleLessonType(t: string) {
    setLessonTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  async function generateLesson() {
    if (lessonTypes.length === 0) {
      setLessonError("请至少选择一种题型");
      return;
    }
    setGenerating(true);
    setLessonError("");
    setLessonResult(null);
    try {
      const res = await apiFetch(
        `/api/classrooms/${params.id}/readings/${params.readingId}/lesson`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            format: lessonFormat,
            questionTypes: lessonTypes,
            questionCount: lessonCount,
            extra: lessonExtra,
            wordExplanation: lessonWordExplanation,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成失败");
      setLessonResult({ filename: data.filename, dataUrl: data.dataUrl });
    } catch (e) {
      setLessonError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  if (!reading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-zinc-400">
        {error ? error : "加载中…"}
      </div>
    );
  }

  const isTeacher = myRole === "teacher";
  const showPrep = prepMode && isTeacher;
  const rules = buildRules(annotations, questions);
  const hasNotes = annotations.length > 0;
  const allAnswered =
    questions.length === 0 || answeredCount >= questions.length;
  const flowDone = hasNotes && allAnswered;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href={`/teaching/${params.id}/assignments`}
        className="text-sm text-zinc-500 hover:text-orange-600"
      >
        ← {showPrep ? "退出备课" : "返回课后作业"}
      </Link>

      {/* 页面功能引导 */}
      {!showPrep && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <p className="font-semibold text-blue-700">页面说明</p>
          {isTeacher ? (
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-600">
              <li>
                <b>选中原文</b>可添加题目（发布后学生作答）或加入备课笔记。
              </li>
              <li>
                <b>点进题目</b>可查看学生作答并批改留言。
              </li>
              <li>
                顶部「<b>班级作答分析</b>」可查看班级总体与每个学生情况；备课笔记旁「
                <b>生成辅助课件</b>」可基于批注生成可下载课件。
              </li>
            </ul>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-600">
              <li>
                <b>选中原文</b>可勾画生词、添加批注提出疑问。
              </li>
              <li>
                <b>点进题目</b>进行作答，等待老师批改。
              </li>
              <li>
                完成勾画与作答后，可一键<b>加入语料库</b>继续学习。
              </li>
            </ul>
          )}
        </div>
      )}

      {showPrep && (
        <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50/60 p-4">
          <p className="font-semibold text-orange-700">备课模式</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
            <li>选中原文，可<b>添加题目</b>（发布后学生可见）或<b>勾画词汇/批注</b>（仅备课用，学生不可见）。</li>
            <li>勾画与批注会作为 AI 生成教学课件的重点依据。</li>
            <li>完成后点击右上角「辅助备课」，选择格式与题型生成课件。</li>
          </ol>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          {reading.title}
        </h1>
        {showPrep && (
          <button
            onClick={() => setShowLesson(true)}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            辅助备课
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-zinc-400">
        {showPrep
          ? "选中原文句子可勾画、批注或添加题目；批注作为 AI 生成课件的依据"
          : isTeacher
            ? "选中原文可添加题目（发布后学生作答）或加入备课笔记；点进题目查看作答与班级分析"
            : "选中原文可勾画词汇或添加批注；点进题目进行作答"}
      </p>

      {/* 班级作答分析（教师） */}
      {isTeacher && !showPrep && (
        <div className="mt-4">
          <Link
            href={`/teaching/${params.id}/readings/${params.readingId}/analysis`}
            className="block rounded-xl border border-orange-100 bg-orange-50/40 p-4 transition hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  班级作答分析
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  基于学生作答、提问批注与教师批注，生成班级总体情况与每个学生的阅读情况
                </p>
              </div>
              <span className="text-sm font-semibold text-orange-600">
                进入 →
              </span>
            </div>
          </Link>
        </div>
      )}

      {!isTeacher && !showPrep && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <p className="font-semibold text-blue-700">学习引导</p>
          <ul className="mt-2 space-y-1.5 text-sm text-zinc-600">
            <li className="flex items-center gap-2">
              <span className={hasNotes ? "text-emerald-600" : "text-zinc-300"}>
                {hasNotes ? "✓" : "○"}
              </span>
              勾画生词、添加批注，提出你的疑惑
            </li>
            <li className="flex items-center gap-2">
              <span
                className={allAnswered ? "text-emerald-600" : "text-zinc-300"}
              >
                {allAnswered ? "✓" : "○"}
              </span>
              回答老师的问题（已答 {answeredCount}/{questions.length}）
            </li>
          </ul>
          <div className="mt-3 border-t border-blue-100 pt-3">
            {addedToCorpus ? (
              <p className="text-sm font-medium text-emerald-700">
                已加入语料库，可前往「语料库」继续学习
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={addToCorpus}
                  disabled={addingToCorpus}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {addingToCorpus ? "AI 提取中…" : "加入语料库"}
                </button>
                <span className="text-xs text-zinc-400">
                  {flowDone
                    ? "阅读与作答已完成，建议加入语料库继续学习"
                    : "完成勾画与作答后，即可将文章加入语料库"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div
        onMouseUp={handleMouseUp}
        className="mt-4 rounded-xl border border-zinc-100 bg-white p-6 text-[17px] leading-8 text-zinc-800 shadow-sm"
      >
        {reading.raw_text
          .split(/\n+/)
          .filter((p) => p.trim())
          .map((para, i) => (
            <p key={i} className="mb-4 last:mb-0">
              {renderParagraph(para, rules)}
            </p>
          ))}
      </div>

      {/* 题目（点击进入查看/作答） */}
      {questions.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-zinc-700">
            题目（{questions.length}）
          </h3>
          <div className="mt-3 space-y-2">
            {questions.map((q) => (
              <div key={q.id} className="group relative">
                <Link
                  href={`/teaching/${params.id}/readings/${params.readingId}/questions/${q.id}`}
                  className="block rounded-xl border border-orange-100 bg-orange-50/40 p-4 transition hover:shadow-md"
                >
                  <p className="text-sm text-zinc-500">{q.sentence}</p>
                  <p className="mt-1 text-base font-medium text-zinc-900">
                    {q.question}
                  </p>
                  <p className="mt-2 text-xs text-orange-600">
                    {isTeacher ? "查看学生作答 →" : "去作答 →"}
                  </p>
                </Link>
                {isTeacher && (
                  <button
                    onClick={() => deleteQuestion(q.id)}
                    className="absolute right-3 top-3 text-xs text-zinc-400 hover:text-red-600"
                  >
                    删除
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 备课笔记 / 勾画与批注 */}
      {annotations.length > 0 && (
        <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/60 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-700">
              {isTeacher ? "备课笔记" : "我的勾画与批注"}
            </h3>
            {isTeacher && (
              <button
                onClick={() => setShowLesson(true)}
                className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
              >
                生成辅助课件
              </button>
            )}
          </div>
          <ul className="mt-2 space-y-2">
            {annotations.map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-2 rounded-lg border border-zinc-100 bg-white p-3"
              >
                <span
                  className={`rounded px-1.5 py-0.5 text-sm font-medium ${ANNOTATION_BG[a.color] ?? "bg-yellow-200"}`}
                >
                  {a.text}
                </span>
                {a.note && (
                  <span className="flex-1 text-sm text-zinc-600">{a.note}</span>
                )}
                <button
                  onClick={() => deleteAnnotation(a.id)}
                  className="shrink-0 text-sm text-zinc-300 hover:text-red-600"
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 工具栏 */}
      {toolbar && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full rounded-xl border border-zinc-200 bg-white p-2 shadow-lg"
          style={{ left: toolbar.x, top: toolbar.y - 8 }}
        >
          <div className="flex items-center gap-1.5">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => createAnnotation(color)}
                title={`勾画为${color}`}
                className={`h-6 w-6 rounded-full border border-zinc-200 ${ANNOTATION_BG[color]}`}
              />
            ))}
            <span className="mx-1 h-5 w-px bg-zinc-200" />
            <button
              onClick={() => {
                setNoteInput(true);
                setQuestionInput(false);
              }}
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
            >
              批注
            </button>
            {isTeacher && (
              <button
                onClick={() => {
                  setQuestionInput(true);
                  setNoteInput(false);
                }}
                className="rounded-md px-2 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50"
              >
                添加题目
              </button>
            )}
            <button
              onClick={() => setToolbar(null)}
              className="rounded-md px-1.5 py-1 text-xs text-zinc-400 hover:bg-zinc-100"
            >
              ×
            </button>
          </div>

          {noteInput && (
            <div className="mt-2 border-t border-zinc-100 pt-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="写批注…"
                rows={2}
                autoFocus
                className="w-full rounded-lg border border-zinc-200 p-2 text-xs outline-none focus:border-orange-400"
              />
              <button
                onClick={() => createAnnotation("yellow", noteText)}
                className="mt-1 rounded-md bg-orange-600 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-700"
              >
                保存批注
              </button>
            </div>
          )}

          {questionInput && (
            <div className="mt-2 border-t border-zinc-100 pt-2">
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="针对选中句子出个题目…"
                rows={2}
                autoFocus
                className="w-full rounded-lg border border-zinc-200 p-2 text-xs outline-none focus:border-orange-400"
              />
              <button
                onClick={addQuestion}
                className="mt-1 rounded-md bg-orange-600 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-700"
              >
                保存题目
              </button>
            </div>
          )}
        </div>
      )}

      {showLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900">辅助备课</h2>
              <button
                onClick={() => setShowLesson(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                关闭
              </button>
            </div>

            {lessonResult ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-medium text-emerald-700">
                  课件已生成
                </p>
                <p className="mt-1 break-all text-xs text-zinc-500">
                  {lessonResult.filename}
                </p>
                <a
                  href={lessonResult.dataUrl}
                  download={lessonResult.filename}
                  className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  下载课件
                </a>
                <button
                  onClick={() => {
                    setLessonResult(null);
                    setShowLesson(false);
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
                        onClick={() => setLessonFormat(f)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                          lessonFormat === f
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
                        onClick={() => toggleLessonType(t.value)}
                        className={`rounded-lg border px-3 py-1.5 text-sm ${
                          lessonTypes.includes(t.value)
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
                    value={lessonCount}
                    onChange={(e) =>
                      setLessonCount(Number(e.target.value) || 1)
                    }
                    className="mt-2 w-28 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                  />
                </div>

                <label className="mt-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={lessonWordExplanation}
                    onChange={(e) => setLessonWordExplanation(e.target.checked)}
                    className="h-4 w-4 accent-orange-600"
                  />
                  <span className="text-sm font-semibold text-zinc-700">
                    需要单词讲解
                  </span>
                  <span className="text-xs text-zinc-400">
                    （为勾画的单词生成词性、释义、例句；PPT 一词一页，Word 用字号区分）
                  </span>
                </label>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-zinc-700">
                    补充需求（可选）
                  </p>
                  <textarea
                    value={lessonExtra}
                    onChange={(e) => setLessonExtra(e.target.value)}
                    placeholder="例如：侧重语法点、加入课堂讨论环节…"
                    rows={3}
                    className="mt-2 w-full rounded-lg border border-zinc-200 p-2 text-sm outline-none focus:border-orange-400"
                  />
                </div>

                {lessonError && (
                  <p className="mt-3 text-sm text-red-600">{lessonError}</p>
                )}

                <button
                  onClick={generateLesson}
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
