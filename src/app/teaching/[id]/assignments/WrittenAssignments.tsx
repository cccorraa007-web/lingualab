"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/auth";

type Role = "teacher" | "student";
interface Assignment { id: string; title: string; content: string; ends_at: string; }
interface Submission { assignment_id: string; grade: string | null; score: number | null; feedback: string | null; }

export default function WrittenAssignments({ classroomId, role }: { classroomId: string; role: Role }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [counts, setCounts] = useState<Record<string, { submitted: number; total: number }>>({});
  const [showPublish, setShowPublish] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [serverNow, setServerNow] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    apiFetch(`/api/classrooms/${classroomId}/assignments`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "加载笔头作业失败");
      setAssignments(data.assignments ?? []);
      setSubmissions(data.submissions ?? []);
      setServerNow(data.server_now ?? new Date().toISOString());
      if (role === "teacher") {
        const next: Record<string, { submitted: number; total: number }> = {};
        for (const assignment of data.assignments ?? []) next[assignment.id] = { submitted: 0, total: 0 };
        for (const recipient of data.recipients ?? []) if (next[recipient.assignment_id]) next[recipient.assignment_id].total += 1;
        for (const submission of data.submissions ?? []) if (next[submission.assignment_id]) next[submission.assignment_id].submitted += 1;
        setCounts(next);
      }
    }).catch((e) => setError(e instanceof Error ? e.message : "加载失败")).finally(() => setLoading(false));
  }, [classroomId, reloadKey, role]);

  async function publish() {
    if (!title.trim() || !content.trim() || !endsAt) return setError("请填写题目、要求和截止时间");
    setBusy(true); setError("");
    try {
      const form = new FormData();
      form.set("title", title.trim()); form.set("content", content.trim()); form.set("ends_at", new Date(endsAt).toISOString());
      files.forEach((file) => form.append("files", file));
      const response = await apiFetch(`/api/classrooms/${classroomId}/assignments`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "发布失败");
      setTitle(""); setContent(""); setEndsAt(""); setFiles([]); setShowPublish(false); reload();
    } catch (e) { setError(e instanceof Error ? e.message : "发布失败"); } finally { setBusy(false); }
  }

  return <section className="mt-8 border-t border-zinc-100 pt-8">
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-zinc-900">笔头作业</h2><p className="mt-1 text-xs text-zinc-400">点击作业进入详情、提交或批改。</p></div>{role === "teacher" && <button onClick={() => setShowPublish((v) => !v)} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">{showPublish ? "收起" : "发布笔头作业"}</button>}</div>
    {error && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {role === "teacher" && showPublish && <div className="mt-4 space-y-3 rounded-xl border border-orange-200 bg-orange-50/40 p-4">
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} placeholder="作业题目" className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm" />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={12000} rows={5} placeholder="作业要求" className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm" />
      <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm" />
      <input type="file" multiple accept="image/*,audio/*,video/mp4,video/webm,application/pdf" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))} className="block w-full text-sm text-zinc-500" />
      <button onClick={publish} disabled={busy} className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "发布中…" : "发布作业"}</button>
    </div>}
    <div className="mt-4 space-y-2">{loading ? <Empty text="加载中…" /> : assignments.length === 0 ? <Empty text="还没有笔头作业" /> : assignments.map((assignment) => {
      const ended = Boolean(serverNow) && new Date(serverNow).getTime() > new Date(assignment.ends_at).getTime();
      const mine = submissions.find((item) => item.assignment_id === assignment.id);
      return <Link key={assignment.id} href={`/teaching/${classroomId}/assignments/${assignment.id}`} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white p-4 transition hover:shadow-md"><div><p className="font-medium text-zinc-900">{assignment.title}</p><p className="mt-1 text-xs text-zinc-400">截止 {new Date(assignment.ends_at).toLocaleString("zh-CN")}</p></div><div className="flex items-center gap-2 text-xs"><span className={`rounded-full px-2.5 py-0.5 font-semibold ${ended ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>{ended ? "已截止" : "进行中"}</span><span className="text-zinc-500">{role === "teacher" ? `已交 ${counts[assignment.id]?.submitted ?? 0}/${counts[assignment.id]?.total ?? 0}` : mine ? mine.grade ? `已评分 ${mine.grade}` : mine.score != null ? `历史评分 ${mine.score}` : "已提交" : "未提交"}</span></div></Link>;
    })}</div>
  </section>;
}

function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-zinc-400">{text}</div>; }
