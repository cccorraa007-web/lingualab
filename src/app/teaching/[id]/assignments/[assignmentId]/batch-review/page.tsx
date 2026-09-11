"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/auth";

interface Item { question_index:number; student_answer:string; reference_answer:string; is_correct:boolean; issues:string; suggested_grade:string }
interface Result { student_id:string; submission_id?:string; items:Item[]; grade:string; feedback:string; saved?:boolean }
const GRADES = ["A+", "A", "B+", "B", "C+", "C", "D"];

export default function BatchReviewPage() {
  const params = useParams<{id:string; assignmentId:string}>();
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function run() {
    if (!files.length) return setError("请先上传参考答案文件");
    setBusy("正在解析文件、OCR 与 AI 对照…"); setError("");
    try {
      const form = new FormData(); files.forEach((file) => form.append("teacher_answer_files", file));
      const response = await apiFetch(`/api/classrooms/${params.id}/assignments/${params.assignmentId}/batch-review`, { method:"POST", body:form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "批改失败");
      const ids = new Map<string,string>((data.submissions ?? []).map((item:{user_id:string; id:string}) => [item.user_id, item.id]));
      setResults((data.results ?? []).map((result:Result) => ({ ...result, submission_id:ids.get(result.student_id), grade:result.items?.[0]?.suggested_grade || "B", feedback:(result.items ?? []).map((item:Item) => `第${item.question_index}题：${item.is_correct ? "正确" : "需修改"}${item.issues ? `；${item.issues}` : ""}`).join("\n") })));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "批改失败"); }
    finally { setBusy(""); }
  }

  async function adopt(index:number) {
    const result = results[index]; if (!result.submission_id) return;
    setBusy(`save-${index}`);
    try {
      const response = await apiFetch(`/api/classrooms/${params.id}/assignments/${params.assignmentId}/review`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ submission_id:result.submission_id, grade:result.grade, feedback:result.feedback }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "保存失败");
      setResults((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, saved:true } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setBusy(""); }
  }

  return <div className="mx-auto max-w-5xl px-4 py-10">
    <Link href={`/teaching/${params.id}/assignments/${params.assignmentId}`} className="text-sm text-zinc-500">← 返回作业详情</Link>
    <h1 className="mt-4 text-2xl font-bold">一键批改</h1>
    <p className="mt-2 text-sm text-zinc-500">AI 结果仅作建议，教师确认“采纳”后才写入成绩。</p>
    <section className="mt-6 rounded-2xl border bg-white p-6">
      <input type="file" multiple accept="image/*,.pdf,.docx" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5))} />
      <p className="mt-2 text-xs text-zinc-400">支持图片、PDF（含扫描件，最多 30 页）和 DOCX；最多 5 个文件、单个 25MB。</p>
      <button onClick={run} disabled={!!busy || !files.length} className="mt-4 rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy && !busy.startsWith("save-") ? busy : "开始一键批改"}</button>
    </section>
    {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-6 space-y-4">{results.map((result,index) => <section key={result.student_id} className="rounded-2xl border bg-white p-5">
      <h2 className="font-semibold">学生 {result.student_id}</h2>
      {result.items.map((item) => <div key={item.question_index} className="mt-3 rounded-xl bg-zinc-50 p-3 text-sm"><b className={item.is_correct ? "text-emerald-700" : "text-red-700"}>第 {item.question_index} 题 · {item.is_correct ? "正确" : "需修改"}</b><p>学生：{item.student_answer || "（空）"}</p><p>参考：{item.reference_answer}</p>{item.issues && <p className="text-red-700">问题：{item.issues}</p>}</div>)}
      <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr]"><select value={result.grade} onChange={(event) => setResults((current) => current.map((item,itemIndex) => itemIndex === index ? { ...item, grade:event.target.value, saved:false } : item))} className="rounded-lg border p-2">{GRADES.map((grade) => <option key={grade}>{grade}</option>)}</select><textarea value={result.feedback} onChange={(event) => setResults((current) => current.map((item,itemIndex) => itemIndex === index ? { ...item, feedback:event.target.value, saved:false } : item))} rows={4} className="rounded-lg border p-3 text-sm" /></div>
      <button onClick={() => adopt(index)} disabled={busy === `save-${index}` || result.saved} className="mt-3 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{result.saved ? "已采纳" : busy === `save-${index}` ? "保存中…" : "采纳"}</button>
    </section>)}</div>
  </div>;
}
