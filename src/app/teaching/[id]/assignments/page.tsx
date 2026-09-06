"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/auth";
import { langMeta } from "@/lib/language";

interface Reading {
  id: string;
  title: string;
  raw_text: string;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  question_count?: number;
  answered_count?: number;
  done?: boolean;
}

interface Material {
  id: string;
  title: string | null;
  raw_text: string;
}

interface HwAssignment {
  id: string;
  title: string;
  content: string;
  ends_at: string;
  created_by: string;
  created_at: string;
  recipient_count?: number;
  submitted_count?: number;
  my_submitted?: boolean;
}

interface HwSubmission {
  id: string;
  assignment_id: string;
  user_id: string;
  content: string | null;
  media_paths: string[];
  feedback: string | null;
  score: number | null;
  submitted_at: string;
  graded_at: string | null;
  email?: string;
}

interface HwDetail {
  assignment: HwAssignment;
  submissions: HwSubmission[];
  missing: { user_id: string; email: string }[];
  my_submission: HwSubmission | null;
}

function hwStatus(a: HwAssignment): { text: string; cls: string } {
  const now = Date.now();
  const end = new Date(a.ends_at).getTime();
  if (now > end) return { text: "已截止", cls: "bg-red-100 text-red-600" };
  return { text: "进行中", cls: "bg-emerald-100 text-emerald-700" };
}

function readingStatus(r: Reading): { text: string; cls: string } {
  const now = Date.now();
  const start = new Date(r.starts_at).getTime();
  const end = r.ends_at ? new Date(r.ends_at).getTime() : Infinity;
  if (now < start) return { text: "未开始", cls: "bg-zinc-100 text-zinc-500" };
  if (now > end) return { text: "已截止", cls: "bg-red-100 text-red-600" };
  return { text: "进行中", cls: "bg-emerald-100 text-emerald-700" };
}

function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export default function ClassroomAssignmentsPage() {
  const params = useParams<{ id: string }>();
  const [myRole, setMyRole] = useState<"teacher" | "student">("student");
  const [classroomLang, setClassroomLang] = useState<string>("");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [showPublish, setShowPublish] = useState(false);
  const [pTitle, setPTitle] = useState("");
  const [pText, setPText] = useState("");
  const [pStart, setPStart] = useState("");
  const [pEndDate, setPEndDate] = useState("");
  const [pEndTime, setPEndTime] = useState(nowTime);
  const [publishing, setPublishing] = useState(false);

  const [hw, setHw] = useState<HwAssignment[]>([]);
  const [showHwPublish, setShowHwPublish] = useState(false);
  const [hwTitle, setHwTitle] = useState("");
  const [hwContent, setHwContent] = useState("");
  const [hwEndDate, setHwEndDate] = useState("");
  const [hwEndTime, setHwEndTime] = useState(nowTime);
  const [hwPublishing, setHwPublishing] = useState(false);
  const [hwDetailId, setHwDetailId] = useState<string | null>(null);
  const [hwDetail, setHwDetail] = useState<HwDetail | null>(null);
  const [hwSubmitText, setHwSubmitText] = useState("");
  const [hwSubmitting, setHwSubmitting] = useState(false);
  const [hwFeedback, setHwFeedback] = useState<Record<string, string>>({});
  const [hwScore, setHwScore] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    apiFetch(`/api/classrooms/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          setMyRole(d.my_role);
          setClassroomLang(d.classroom?.lang ?? "");
        }
      })
      .catch(() => {});

    apiFetch(`/api/classrooms/${params.id}/readings`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setReadings(d.readings ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    apiFetch("/api/materials")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setMaterials(d.materials ?? []);
      })
      .catch(() => {});

    apiFetch(`/api/classrooms/${params.id}/assignments`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setHw(d.assignments ?? []);
      })
      .catch(() => {});
  }, [params.id, reloadKey]);

  async function pickMaterial(id: string) {
    const res = await apiFetch(`/api/materials/${id}`);
    const d = await res.json();
    if (res.ok && d.material) {
      if (d.material.title) setPTitle(d.material.title);
      setPText(d.material.raw_text ?? "");
    }
  }

  async function publish() {
    if (!pTitle.trim()) {
      setError("请填写标题");
      return;
    }
    if (!pText.trim()) {
      setError("请填写正文");
      return;
    }
    if (!pEndDate) {
      setError("请设置截止日期");
      return;
    }
    setPublishing(true);
    setError("");
    try {
      const endsAt = `${pEndDate}T${pEndTime || nowTime()}`;
      const res = await apiFetch(`/api/classrooms/${params.id}/readings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pTitle.trim(),
          text: pText.trim(),
          starts_at: pStart,
          ends_at: endsAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "发布失败");
      setShowPublish(false);
      setPTitle("");
      setPText("");
      setPStart("");
      setPEndDate("");
      setPEndTime(nowTime());
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
  }

  async function publishHw() {
    if (!hwTitle.trim()) {
      setError("请填写作业标题");
      return;
    }
    if (!hwContent.trim()) {
      setError("请填写作业内容");
      return;
    }
    if (!hwEndDate) {
      setError("请设置截止日期");
      return;
    }
    setHwPublishing(true);
    setError("");
    try {
      const endsAt = `${hwEndDate}T${hwEndTime || nowTime()}`;
      const res = await apiFetch(`/api/classrooms/${params.id}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: hwTitle.trim(),
          content: hwContent.trim(),
          ends_at: endsAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "发布失败");
      setShowHwPublish(false);
      setHwTitle("");
      setHwContent("");
      setHwEndDate("");
      setHwEndTime(nowTime());
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setHwPublishing(false);
    }
  }

  async function loadHwDetail(id: string) {
    const res = await apiFetch(`/api/classrooms/${params.id}/assignments/${id}`);
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "加载失败");
    setHwDetailId(id);
    setHwDetail(d);
    setHwSubmitText("");
    setHwFeedback({});
    setHwScore({});
  }

  async function toggleHwDetail(id: string) {
    if (hwDetailId === id) {
      setHwDetailId(null);
      setHwDetail(null);
      return;
    }
    setError("");
    try {
      await loadHwDetail(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function submitHw(assignmentId: string) {
    if (!hwSubmitText.trim()) {
      setError("提交内容不能为空");
      return;
    }
    setHwSubmitting(true);
    setError("");
    try {
      const res = await apiFetch(
        `/api/classrooms/${params.id}/assignments/${assignmentId}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: hwSubmitText.trim() }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "提交失败");
      await loadHwDetail(assignmentId);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setHwSubmitting(false);
    }
  }

  async function gradeHw(submissionId: string) {
    const feedback = (hwFeedback[submissionId] ?? "").trim();
    const scoreRaw = (hwScore[submissionId] ?? "").trim();
    const score = scoreRaw === "" ? null : Number(scoreRaw);
    setError("");
    try {
      const res = await apiFetch(
        `/api/classrooms/${params.id}/assignments/${hwDetail?.assignment.id}/submissions/${submissionId}/grade`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback, score }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "批改失败");
      if (hwDetail) await loadHwDetail(hwDetail.assignment.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href={`/teaching/${params.id}`}
        className="text-sm text-zinc-500 hover:text-orange-600"
      >
        ← 返回班级
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
        {myRole === "teacher" ? "布置作业" : "课后作业"}
      </h1>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 必读文章 */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">必读文章</h2>
            {(classroomLang === "es" || classroomLang === "en") && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                {langMeta(classroomLang as "es" | "en").label}
              </span>
            )}
          </div>
          {myRole === "teacher" && (
            <button
              onClick={() => setShowPublish(!showPublish)}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              {showPublish ? "收起" : "发布文章"}
            </button>
          )}
        </div>

        {myRole === "teacher" && (
          <p className="mt-2 text-xs text-zinc-400">
            发布后，点进文章可「划线出题」和「勾画批注」，用于准备备课材料。
          </p>
        )}

        {myRole === "teacher" && showPublish && (
          <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50/40 p-4">
            <div className="flex items-center gap-2">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) pickMaterial(e.target.value);
                }}
                className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">从语料库选择…</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title || "未命名文章"}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={pTitle}
              onChange={(e) => setPTitle(e.target.value)}
              placeholder="文章标题"
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
            <textarea
              value={pText}
              onChange={(e) => setPText(e.target.value)}
              placeholder="粘贴文章正文（或从上方语料库选择）"
              rows={5}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-3">
              <label className="text-xs font-semibold text-zinc-600">
                截止日期<span className="text-red-500">（必填）</span>
                <input
                  type="date"
                  value={pEndDate}
                  onChange={(e) => setPEndDate(e.target.value)}
                  className="ml-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-zinc-600">
                截止时间
                <input
                  type="time"
                  value={pEndTime}
                  onChange={(e) => setPEndTime(e.target.value)}
                  className="ml-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-zinc-600">
                开始时间<span className="text-zinc-400">（可选）</span>
                <input
                  type="datetime-local"
                  value={pStart}
                  onChange={(e) => setPStart(e.target.value)}
                  className="ml-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            <button
              onClick={publish}
              disabled={publishing}
              className="mt-3 rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {publishing ? "发布中…" : "发布"}
            </button>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-zinc-400">
              加载中…
            </div>
          ) : readings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-zinc-400">
              还没有必读文章
            </div>
          ) : (
            readings.map((r) => {
              const s = readingStatus(r);
              const isActive = s.text === "进行中";
              const hasQuestions = (r.question_count ?? 0) > 0;
              const pending = myRole === "student" && isActive && !r.done;
              return (
                <div
                  key={r.id}
                  className="group relative rounded-xl border border-zinc-100 bg-white transition hover:shadow-md"
                >
                  <Link
                    href={`/teaching/${params.id}/readings/${r.id}`}
                    className="flex items-center justify-between p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-zinc-900">
                          {r.title}
                        </p>
                        {pending && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">
                        {r.ends_at
                          ? `截止 ${new Date(r.ends_at).toLocaleString("zh-CN")}`
                          : "长期有效"}
                      </p>
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-2">
                      {myRole === "student" && isActive && hasQuestions && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            r.done
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {r.done
                            ? `已完成 ${r.answered_count}/${r.question_count}`
                            : `待完成 ${r.answered_count}/${r.question_count}`}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}
                      >
                        {s.text}
                      </span>
                    </div>
                  </Link>
                  {myRole === "teacher" && (
                    <Link
                      href={`/teaching/${params.id}/readings/${r.id}?prep=1`}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow transition group-hover:opacity-100"
                    >
                      进入备课
                    </Link>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 笔头作业 */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">笔头作业</h2>
          {myRole === "teacher" && (
            <button
              onClick={() => setShowHwPublish(!showHwPublish)}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              {showHwPublish ? "收起" : "发布作业"}
            </button>
          )}
        </div>

        {myRole === "teacher" && showHwPublish && (
          <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50/40 p-4">
            <input
              value={hwTitle}
              onChange={(e) => setHwTitle(e.target.value)}
              placeholder="作业标题"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
            <textarea
              value={hwContent}
              onChange={(e) => setHwContent(e.target.value)}
              placeholder="作业要求（题目内容）"
              rows={4}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-3">
              <label className="text-xs font-semibold text-zinc-600">
                截止日期<span className="text-red-500">（必填）</span>
                <input
                  type="date"
                  value={hwEndDate}
                  onChange={(e) => setHwEndDate(e.target.value)}
                  className="ml-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-zinc-600">
                截止时间
                <input
                  type="time"
                  value={hwEndTime}
                  onChange={(e) => setHwEndTime(e.target.value)}
                  className="ml-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            <button
              onClick={publishHw}
              disabled={hwPublishing}
              className="mt-3 rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {hwPublishing ? "发布中…" : "发布"}
            </button>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {hw.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-zinc-400">
              还没有笔头作业
            </div>
          ) : (
            hw.map((a) => {
              const s = hwStatus(a);
              const open = hwDetailId === a.id;
              return (
                <div
                  key={a.id}
                  className="rounded-xl border border-zinc-100 bg-white transition hover:shadow-md"
                >
                  <button
                    onClick={() => toggleHwDetail(a.id)}
                    className="flex w-full items-center justify-between p-4 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-900">
                        {a.title}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        截止 {new Date(a.ends_at).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-2">
                      {myRole === "teacher" && (
                        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
                          已交 {a.submitted_count}/{a.recipient_count}
                        </span>
                      )}
                      {myRole === "student" && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            a.my_submitted
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {a.my_submitted ? "已提交" : "未提交"}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}
                      >
                        {s.text}
                      </span>
                    </div>
                  </button>

                  {open && hwDetail && (
                    <div className="border-t border-zinc-100 p-4">
                      <p className="whitespace-pre-wrap text-sm text-zinc-700">
                        {hwDetail.assignment.content}
                      </p>

                      {myRole === "student" &&
                        (hwDetail.my_submission ? (
                          <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                            <p className="text-xs text-zinc-400">我的提交</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">
                              {hwDetail.my_submission.content}
                            </p>
                            {hwDetail.my_submission.feedback ? (
                              <div className="mt-2 rounded bg-emerald-50 px-2 py-1 text-sm text-emerald-700">
                                教师评语：{hwDetail.my_submission.feedback}
                                {hwDetail.my_submission.score != null &&
                                  `（${hwDetail.my_submission.score} 分）`}
                              </div>
                            ) : (
                              <p className="mt-2 text-xs text-zinc-400">
                                等待教师批改…
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="mt-4">
                            <textarea
                              value={hwSubmitText}
                              onChange={(e) => setHwSubmitText(e.target.value)}
                              placeholder="写下你的作业…"
                              rows={4}
                              className="w-full rounded-lg border border-zinc-200 p-2 text-sm outline-none focus:border-orange-400"
                            />
                            <button
                              onClick={() => submitHw(hwDetail.assignment.id)}
                              disabled={hwSubmitting}
                              className="mt-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                            >
                              {hwSubmitting ? "提交中…" : "提交作业"}
                            </button>
                          </div>
                        ))}

                      {myRole === "teacher" && (
                        <div className="mt-4 space-y-3">
                          <p className="text-sm font-semibold text-zinc-700">
                            学生提交（{hwDetail.submissions.length}）
                          </p>
                          {hwDetail.submissions.length === 0 && (
                            <p className="text-sm text-zinc-400">暂无学生提交</p>
                          )}
                          {hwDetail.submissions.map((sub) => (
                            <div
                              key={sub.id}
                              className="rounded-lg border border-zinc-100 bg-zinc-50 p-3"
                            >
                              <p className="text-xs text-zinc-400">{sub.email}</p>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">
                                {sub.content}
                              </p>
                              {sub.feedback ? (
                                <p className="mt-2 rounded bg-emerald-50 px-2 py-1 text-sm text-emerald-700">
                                  已批改：{sub.feedback}
                                  {sub.score != null && `（${sub.score} 分）`}
                                </p>
                              ) : (
                                <div className="mt-2 flex gap-2">
                                  <input
                                    value={hwFeedback[sub.id] ?? ""}
                                    onChange={(e) =>
                                      setHwFeedback((prev) => ({
                                        ...prev,
                                        [sub.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="写评语…"
                                    className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm"
                                  />
                                  <input
                                    value={hwScore[sub.id] ?? ""}
                                    onChange={(e) =>
                                      setHwScore((prev) => ({
                                        ...prev,
                                        [sub.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="分数"
                                    type="number"
                                    className="w-20 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm"
                                  />
                                  <button
                                    onClick={() => gradeHw(sub.id)}
                                    className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700"
                                  >
                                    批改
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}

                          {hwDetail.missing.length > 0 && (
                            <div>
                              <p className="text-sm font-semibold text-zinc-700">
                                未交（{hwDetail.missing.length}）
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {hwDetail.missing.map((m) => (
                                  <span
                                    key={m.user_id}
                                    className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs text-red-600"
                                  >
                                    {m.email || "未知"}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
