"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
  const [reading, setReading] = useState<Reading | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [myRole, setMyRole] = useState<string>("student");
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const [noteInput, setNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [questionInput, setQuestionInput] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

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
        setMyRole(d.my_role ?? "student");
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

  if (!reading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-zinc-400">
        {error ? error : "加载中…"}
      </div>
    );
  }

  const isTeacher = myRole === "teacher" || myRole === "leader";
  const rules = buildRules(annotations, questions);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href={`/teaching/${params.id}/assignments`}
        className="text-sm text-zinc-500 hover:text-orange-600"
      >
        ← 返回课后作业
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
        {reading.title}
      </h1>
      <p className="mt-1 text-xs text-zinc-400">
        {isTeacher
          ? "选中原文句子可勾画、批注或添加题目"
          : "选中原文文字可勾画词汇或添加句子批注"}
      </p>

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

      {/* 题目卡片 */}
      {questions.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-zinc-700">
            题目（{questions.length}）
          </h3>
          <div className="mt-3 space-y-3">
            {questions.map((q) => (
              <div
                key={q.id}
                className="rounded-xl border border-orange-100 bg-orange-50/40 p-4"
              >
                <p className="text-sm text-zinc-500 line-through">{q.sentence}</p>
                <p className="mt-1 text-base font-medium text-zinc-900">
                  {q.question}
                </p>
                {isTeacher && (
                  <button
                    onClick={() => deleteQuestion(q.id)}
                    className="mt-2 text-xs text-zinc-400 hover:text-red-600"
                  >
                    删除题目
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 我的勾画与批注 */}
      {annotations.length > 0 && (
        <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/60 p-4">
          <h3 className="text-sm font-semibold text-zinc-700">我的勾画与批注</h3>
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
    </div>
  );
}
