"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/auth";

type Role = "teacher" | "student";

interface Assignment {
  id: string;
  title: string;
  content: string;
  ends_at: string;
  created_at: string;
}

interface Recipient {
  assignment_id: string;
  user_id: string;
  email: string | null;
}

interface Submission {
  id: string;
  assignment_id: string;
  user_id: string;
  content: string | null;
  feedback: string | null;
  score: number | null;
  max_score: number;
  submitted_at: string;
  updated_at: string;
  media_paths: string[];
  media_urls: { path: string; url: string }[];
  ocr_text: string | null;
}

export default function WrittenAssignments({ classroomId, role }: { classroomId: string; role: Role }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [serverNow, setServerNow] = useState(() => new Date().toISOString());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [showPublish, setShowPublish] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [reviewFeedback, setReviewFeedback] = useState<Record<string, string>>({});
  const [reviewScores, setReviewScores] = useState<Record<string, string>>({});

  const isStaff = role === "teacher";
  const reload = useCallback(() => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/classrooms/${classroomId}/assignments`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "加载笔头作业失败");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        const nextAssignments = (data.assignments ?? []) as Assignment[];
        const nextSubmissions = (data.submissions ?? []) as Submission[];
        setAssignments(nextAssignments);
        setRecipients((data.recipients ?? []) as Recipient[]);
        setSubmissions(nextSubmissions);
        setServerNow(data.server_now || new Date().toISOString());
        setDrafts((current) => {
          const next = { ...current };
          for (const assignment of nextAssignments) {
            const submission = nextSubmissions.find((item) => item.assignment_id === assignment.id);
            if (next[assignment.id] === undefined) next[assignment.id] = submission?.content ?? "";
          }
          return next;
        });
        setError("");
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [classroomId, reloadKey]);

  async function publish() {
    if (!title.trim() || !content.trim() || !endsAt) {
      setError("请填写作业题目、要求和截止时间");
      return;
    }
    const endDate = new Date(endsAt);
    if (Number.isNaN(endDate.getTime())) return setError("截止时间格式不正确");
    setBusy("publish");
    setError("");
    try {
      const response = await apiFetch(`/api/classrooms/${classroomId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, ends_at: endDate.toISOString() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "发布失败");
      setTitle("");
      setContent("");
      setEndsAt("");
      setShowPublish(false);
      reload();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "发布失败");
    } finally {
      setBusy("");
    }
  }

  async function submit(assignmentId: string) {
    const answer = drafts[assignmentId]?.trim();
    const attachments = files[assignmentId] ?? [];
    if (!answer && attachments.length === 0) return setError("请填写作业内容或选择附件");
    setBusy(`submit:${assignmentId}`);
    setError("");
    try {
      const form = new FormData();
      form.set("content", answer ?? "");
      attachments.forEach((file) => form.append("files", file));
      const response = await apiFetch(
        `/api/classrooms/${classroomId}/assignments/${assignmentId}/submit`,
        {
          method: "POST",
          body: form,
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "提交失败");
      setFiles((current) => ({ ...current, [assignmentId]: [] }));
      reload();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "提交失败");
    } finally {
      setBusy("");
    }
  }

  async function extractText(assignmentId: string, submissionId: string) {
    setBusy(`ocr:${submissionId}`);
    setError("");
    try {
      const response = await apiFetch(`/api/classrooms/${classroomId}/assignments/${assignmentId}/ocr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: submissionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "图片文字提取失败");
      reload();
    } catch (ocrError) {
      setError(ocrError instanceof Error ? ocrError.message : "图片文字提取失败");
    } finally {
      setBusy("");
    }
  }

  async function review(assignmentId: string, submissionId: string) {
    const feedback = reviewFeedback[submissionId] ?? "";
    const score = reviewScores[submissionId] ?? "";
    if (!feedback.trim() && !score) return setError("请填写反馈或分数");
    setBusy(`review:${submissionId}`);
    setError("");
    try {
      const response = await apiFetch(
        `/api/classrooms/${classroomId}/assignments/${assignmentId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submission_id: submissionId, feedback, score }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "批改失败");
      setReviewFeedback((current) => ({ ...current, [submissionId]: "" }));
      setReviewScores((current) => ({ ...current, [submissionId]: "" }));
      reload();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "批改失败");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="mt-8 border-t border-zinc-100 pt-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">笔头作业</h2>
          <p className="mt-1 text-xs text-zinc-400">支持文字、图片、音频、视频和 PDF；教师可提取图片文字并批改留档。</p>
        </div>
        {isStaff && (
          <button onClick={() => setShowPublish((visible) => !visible)} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
            {showPublish ? "收起" : "发布笔头作业"}
          </button>
        )}
      </div>

      {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {isStaff && showPublish && (
        <div className="mt-4 space-y-3 rounded-xl border border-orange-200 bg-orange-50/40 p-4">
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} placeholder="作业题目" className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm" />
          <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={12000} rows={5} placeholder="作文题、翻译句或具体作业要求" className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm leading-6" />
          <label className="block text-xs font-semibold text-zinc-600">
            截止时间
            <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="ml-2 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm" />
          </label>
          <button onClick={publish} disabled={busy === "publish"} className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
            {busy === "publish" ? "发布中…" : "发布作业"}
          </button>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {loading ? (
          <EmptyState text="加载中…" />
        ) : assignments.length === 0 ? (
          <EmptyState text="还没有笔头作业" />
        ) : (
          assignments.map((assignment) => {
            const assignmentSubmissions = submissions.filter((item) => item.assignment_id === assignment.id);
            const assignmentRecipients = recipients.filter((item) => item.assignment_id === assignment.id);
            const submittedUsers = new Set(assignmentSubmissions.map((item) => item.user_id));
            const missing = assignmentRecipients.filter((item) => !submittedUsers.has(item.user_id));
            const mySubmission = !isStaff ? assignmentSubmissions[0] : undefined;
            const ended = new Date(assignment.ends_at).getTime() < new Date(serverNow).getTime();
            return (
              <article key={assignment.id} className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-zinc-900">{assignment.title}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">{assignment.content}</p>
                    <p className="mt-2 text-xs text-zinc-400">截止 {new Date(assignment.ends_at).toLocaleString("zh-CN")}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ended ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>
                    {ended ? "已截止" : "进行中"}
                  </span>
                </div>

                {isStaff ? (
                  <StaffPanel assignment={assignment} submissions={assignmentSubmissions} recipients={assignmentRecipients} missing={missing} busy={busy} feedback={reviewFeedback} scores={reviewScores} setFeedback={setReviewFeedback} setScores={setReviewScores} onReview={review} onExtractText={extractText} />
                ) : (
                  <div className="mt-4 border-t border-zinc-100 pt-4">
                    {mySubmission && (
                      <div className="mb-3 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
                        <p>首次提交：{new Date(mySubmission.submitted_at).toLocaleString("zh-CN")} · {new Date(mySubmission.submitted_at) > new Date(assignment.ends_at) ? "迟交" : "按时提交"}</p>
                        {mySubmission.score !== null && <p className="mt-1 font-semibold text-orange-700">评分：{mySubmission.score}/{mySubmission.max_score}</p>}
                        {mySubmission.feedback && <p className="mt-1 whitespace-pre-wrap">教师反馈：{mySubmission.feedback}</p>}
                        {mySubmission.media_urls?.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{mySubmission.media_urls.map((media, index) => <a key={media.path} href={media.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-orange-700 hover:underline">附件 {index + 1}</a>)}</div>}
                      </div>
                    )}
                    <textarea value={drafts[assignment.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [assignment.id]: event.target.value }))} maxLength={20000} rows={6} placeholder="在这里粘贴或输入作业内容" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm leading-6 outline-none focus:border-orange-400" />
                    <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,audio/mpeg,audio/wav,audio/webm,video/mp4,video/webm,application/pdf" onChange={(event) => setFiles((current) => ({ ...current, [assignment.id]: Array.from(event.target.files ?? []).slice(0, 5) }))} className="mt-2 block w-full text-sm text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-semibold" />
                    <p className="mt-1 text-xs text-zinc-400">最多 5 个附件，单个不超过 25MB；重新选择附件会替换原附件。</p>
                    <button onClick={() => submit(assignment.id)} disabled={busy === `submit:${assignment.id}`} className="mt-2 rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
                      {busy === `submit:${assignment.id}` ? "提交中…" : mySubmission ? "更新提交" : ended ? "迟交作业" : "提交作业"}
                    </button>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function StaffPanel({ assignment, submissions, recipients, missing, busy, feedback, scores, setFeedback, setScores, onReview, onExtractText }: {
  assignment: Assignment;
  submissions: Submission[];
  recipients: Recipient[];
  missing: Recipient[];
  busy: string;
  feedback: Record<string, string>;
  scores: Record<string, string>;
  setFeedback: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setScores: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onReview: (assignmentId: string, submissionId: string) => Promise<void>;
  onExtractText: (assignmentId: string, submissionId: string) => Promise<void>;
}) {
  const emailFor = (userId: string) => recipients.find((item) => item.user_id === userId)?.email || userId;
  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <p className="text-sm font-semibold text-zinc-700">已交 {submissions.length}/{recipients.length}</p>
      {missing.length > 0 && <p className="mt-1 text-xs text-red-600">未交：{missing.map((item) => item.email || item.user_id).join("、")}</p>}
      {submissions.length === 0 ? <p className="mt-3 text-sm text-zinc-400">暂时没有学生提交</p> : (
        <div className="mt-3 space-y-3">
          {submissions.map((submission) => (
            <div key={submission.id} className="rounded-lg bg-zinc-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <span>{emailFor(submission.user_id)}</span>
                <span>{new Date(submission.submitted_at).toLocaleString("zh-CN")} · {new Date(submission.submitted_at) > new Date(assignment.ends_at) ? "迟交" : "按时"}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{submission.content}</p>
              {submission.media_urls?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{submission.media_urls.map((media, index) => <a key={media.path} href={media.url} target="_blank" rel="noreferrer" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-orange-700 hover:border-orange-300">查看附件 {index + 1}</a>)}</div>}
              {submission.media_paths?.length > 0 && <button onClick={() => onExtractText(assignment.id, submission.id)} disabled={busy === `ocr:${submission.id}`} className="mt-3 rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-orange-700 disabled:opacity-50">{busy === `ocr:${submission.id}` ? "识别中…" : "提取图片文字"}</button>}
              {submission.ocr_text && <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3"><p className="text-xs font-semibold text-blue-700">图片识别文字</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{submission.ocr_text}</p></div>}
              {(submission.feedback || submission.score !== null) && <div className="mt-3 rounded-lg bg-white p-3 text-sm text-zinc-600"><p>当前评分：{submission.score ?? "未评分"}{submission.score !== null ? `/${submission.max_score}` : ""}</p>{submission.feedback && <p className="mt-1 whitespace-pre-wrap">反馈：{submission.feedback}</p>}</div>}
              <div className="mt-3 grid gap-2 sm:grid-cols-[100px_1fr_auto]">
                <input type="number" min={0} max={100} value={scores[submission.id] ?? ""} onChange={(event) => setScores((current) => ({ ...current, [submission.id]: event.target.value }))} placeholder="分数" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm" />
                <input value={feedback[submission.id] ?? ""} onChange={(event) => setFeedback((current) => ({ ...current, [submission.id]: event.target.value }))} maxLength={8000} placeholder="写反馈" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm" />
                <button onClick={() => onReview(assignment.id, submission.id)} disabled={busy === `review:${submission.id}`} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">{busy === `review:${submission.id}` ? "保存中…" : "保存批改"}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-zinc-400">{text}</div>;
}
