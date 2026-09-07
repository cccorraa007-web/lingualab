"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/auth";

const GRADES = ["A+", "A", "B+", "B", "C+", "C", "D"];
interface ReviewData { assignment: { title: string }; submission: { id: string; user_id: string; content: string | null; submitted_at: string; grade: string | null; feedback: string | null; ocr_text: string | null; media_paths: string[]; media_urls: { path: string; url: string }[] }; recipient?: { email: string | null }; }

export default function AssignmentReviewPage() {
  const params = useParams<{ id: string; assignmentId: string; userId: string }>();
  const [data, setData] = useState<ReviewData | null>(null);
  const [grade, setGrade] = useState(""); const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(""); const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => { apiFetch(`/api/classrooms/${params.id}/assignments/${params.assignmentId}`).then((r) => r.json()).then((result) => {
    const submission = (result.submissions ?? []).find((item: { user_id: string }) => item.user_id === params.userId);
    if (!submission) throw new Error("学生提交不存在"); setData({ assignment: result.assignment, submission, recipient: (result.recipients ?? []).find((item: { user_id: string }) => item.user_id === params.userId) }); setGrade(submission.grade ?? ""); setFeedback(submission.feedback ?? "");
  }).catch((e) => setError(e instanceof Error ? e.message : "加载失败")); }, [params.id, params.assignmentId, params.userId, reloadKey]);
  if (!data) return <div className="mx-auto max-w-4xl px-4 py-10 text-zinc-500">{error || "加载中…"}</div>;
  const { assignment, submission, recipient } = data;
  async function save() { setBusy("review"); setError(""); try { const response = await apiFetch(`/api/classrooms/${params.id}/assignments/${params.assignmentId}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submission_id: submission.id, grade, feedback }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "保存失败"); setReloadKey((key) => key + 1); } catch (e) { setError(e instanceof Error ? e.message : "保存失败"); } finally { setBusy(""); } }
  async function ocr() { setBusy("ocr"); setError(""); try { const response = await apiFetch(`/api/classrooms/${params.id}/assignments/${params.assignmentId}/ocr`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submission_id: submission.id }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "识别失败"); setReloadKey((key) => key + 1); } catch (e) { setError(e instanceof Error ? e.message : "识别失败"); } finally { setBusy(""); } }
  return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6"><Link href={`/teaching/${params.id}/assignments/${params.assignmentId}`} className="text-sm text-zinc-500 hover:text-orange-600">← 返回作业详情</Link><h1 className="mt-3 text-2xl font-bold text-zinc-900">批改：{recipient?.email || params.userId}</h1><p className="mt-1 text-sm text-zinc-500">{assignment.title} · 提交于 {new Date(submission.submitted_at).toLocaleString("zh-CN")}</p>
    {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <section className="mt-6 rounded-2xl border border-zinc-100 bg-white p-6"><p className="whitespace-pre-wrap leading-7 text-zinc-700">{submission.content || "（无文字正文）"}</p>{submission.media_urls?.length > 0 && <div className="mt-4 flex gap-2">{submission.media_urls.map((m: { path: string; url: string }, i: number) => <a key={m.path} href={m.url} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-sm text-orange-700">附件 {i + 1}</a>)}</div>}{submission.media_paths?.length > 0 && <button onClick={ocr} disabled={busy === "ocr"} className="mt-4 rounded-lg border border-orange-200 px-4 py-2 text-sm font-semibold text-orange-700">{busy === "ocr" ? "识别中…" : "提取图片文字"}</button>}{submission.ocr_text && <div className="mt-4 rounded-xl bg-blue-50 p-4"><p className="text-sm font-semibold text-blue-700">图片识别文字</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{submission.ocr_text}</p></div>}</section>
    <section className="mt-6 rounded-2xl border border-orange-100 bg-orange-50/30 p-6"><label className="text-sm font-semibold">评分等级<select value={grade} onChange={(e) => setGrade(e.target.value)} className="ml-3 rounded-lg border bg-white px-3 py-2"><option value="">请选择</option>{GRADES.map((item) => <option key={item}>{item}</option>)}</select></label><textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={6} maxLength={8000} placeholder="教师反馈" className="mt-4 w-full rounded-xl border border-zinc-200 bg-white p-4 text-sm" /><button onClick={save} disabled={busy === "review" || (!grade && !feedback.trim())} className="mt-3 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === "review" ? "保存中…" : "保存批改"}</button></section>
  </div>;
}
