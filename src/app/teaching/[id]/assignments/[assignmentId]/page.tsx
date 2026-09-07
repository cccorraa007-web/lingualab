"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/auth";

interface Media { path: string; url: string; }
interface Assignment { id: string; title: string; content: string; ends_at: string; media_urls: Media[]; class_summary?: string | null; }
interface Submission { id: string; user_id: string; content: string | null; media_urls: Media[]; ocr_text: string | null; feedback: string | null; grade: string | null; submitted_at: string; }
interface Recipient { user_id: string; email: string | null; }

export default function AssignmentDetailPage() {
  const params = useParams<{ id: string; assignmentId: string }>();
  const router = useRouter();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [role, setRole] = useState<"teacher" | "student">("student");
  const [content, setContent] = useState(""); const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    apiFetch(`/api/classrooms/${params.id}/assignments/${params.assignmentId}`).then(async (response) => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "加载失败");
      setAssignment(data.assignment); setRole(data.my_role); setSubmission(data.submission ?? null); setSubmissions(data.submissions ?? []); setRecipients(data.recipients ?? []);
      if (data.submission) setContent(data.submission.content ?? "");
    }).catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, [params.id, params.assignmentId, reloadKey]);

  async function submit() {
    if (!content.trim() && files.length === 0 && !submission?.media_urls?.length) return setError("请填写文字或上传附件");
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.set("content", content); files.forEach((file) => form.append("files", file));
      const response = await apiFetch(`/api/classrooms/${params.id}/assignments/${params.assignmentId}/submit`, { method: "POST", body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "提交失败");
      setFiles([]); setReloadKey((key) => key + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "提交失败"); } finally { setBusy(false); }
  }

  function sendToPolish() {
    if (!assignment || !submission?.feedback) return;
    localStorage.setItem("writing-import", JSON.stringify({ title: assignment.title, essay: [submission.content, submission.ocr_text].filter(Boolean).join("\n\n"), rubric: submission.feedback }));
    router.push("/polish");
  }

  if (!assignment) return <div className="mx-auto max-w-4xl px-4 py-10 text-zinc-500">{error || "加载中…"}</div>;
  const submittedIds = new Set(submissions.map((item) => item.user_id));
  return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
    <Link href={`/teaching/${params.id}/assignments`} className="text-sm text-zinc-500 hover:text-orange-600">← 返回作业列表</Link>
    <div className="mt-4 rounded-2xl border border-zinc-100 bg-white p-6"><div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-zinc-900">{assignment.title}</h1><p className="mt-3 whitespace-pre-wrap leading-7 text-zinc-700">{assignment.content}</p></div>{role === "teacher" && <Link href={`/teaching/${params.id}/assignments/${params.assignmentId}/analysis`} className="shrink-0 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white">班级作答分析</Link>}</div>
      {assignment.media_urls?.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{assignment.media_urls.map((m, i) => <a key={m.path} href={m.url} target="_blank" rel="noreferrer" className="rounded-lg border border-orange-200 px-3 py-2 text-sm text-orange-700">教师附件 {i + 1}</a>)}</div>}
    </div>
    {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {role === "teacher" ? <div className="mt-6 space-y-6">
      <StudentGroup title="已提交" recipients={recipients.filter((r) => submittedIds.has(r.user_id))} submissions={submissions} classroomId={params.id} assignmentId={params.assignmentId} />
      <StudentGroup title="未提交" recipients={recipients.filter((r) => !submittedIds.has(r.user_id))} submissions={[]} classroomId={params.id} assignmentId={params.assignmentId} />
    </div> : <section className="mt-6 rounded-2xl border border-zinc-100 bg-white p-6">
      {submission && <div className="mb-4 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600"><p>提交时间：{new Date(submission.submitted_at).toLocaleString("zh-CN")}</p>{submission.grade && <p className="mt-1 font-semibold text-orange-700">评分：{submission.grade}</p>}{submission.feedback && <p className="mt-2 whitespace-pre-wrap">教师反馈：{submission.feedback}</p>}{submission.media_urls?.length > 0 && <div className="mt-2 flex gap-2">{submission.media_urls.map((m, i) => <a key={m.path} href={m.url} target="_blank" rel="noreferrer" className="text-orange-700">附件 {i + 1}</a>)}</div>}{submission.feedback && <button onClick={sendToPolish} className="mt-3 rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white">加入写作润色</button>}</div>}
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={9} maxLength={20000} placeholder="输入作业正文" className="w-full rounded-xl border border-zinc-200 p-4 text-sm leading-7" />
      <input type="file" multiple accept="image/*,audio/*,video/mp4,video/webm,application/pdf" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))} className="mt-3 block w-full text-sm text-zinc-500" />
      <button onClick={submit} disabled={busy} className="mt-3 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "提交中…" : submission ? "更新提交" : "提交作业"}</button>
    </section>}
  </div>;
}

function StudentGroup({ title, recipients, submissions, classroomId, assignmentId }: { title: string; recipients: Recipient[]; submissions: Submission[]; classroomId: string; assignmentId: string }) {
  return <section><h2 className="text-lg font-semibold text-zinc-900">{title}（{recipients.length}）</h2><div className="mt-3 space-y-2">{recipients.length === 0 ? <p className="text-sm text-zinc-400">暂无</p> : recipients.map((recipient) => { const submission = submissions.find((item) => item.user_id === recipient.user_id); return submission ? <Link key={recipient.user_id} href={`/teaching/${classroomId}/assignments/${assignmentId}/${recipient.user_id}`} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white p-4 hover:shadow-md"><span className="text-sm font-medium text-zinc-800">{recipient.email || recipient.user_id}</span><span className="text-xs text-zinc-500">{submission.grade ? `已评分 ${submission.grade}` : "待批改"} →</span></Link> : <div key={recipient.user_id} className="rounded-xl border border-zinc-100 bg-white p-4 text-sm text-zinc-500">{recipient.email || recipient.user_id}</div>; })}</div></section>;
}
