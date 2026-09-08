"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  apiFetch,
  useUserInfo,
  updateUsername,
  uploadAvatar,
  updateAvatarUrl,
} from "@/lib/auth";
import UserAvatar from "@/components/UserAvatar";

type Tab = "settings" | "stats" | "help";

const TABS: { key: Tab; label: string }[] = [
  { key: "settings", label: "设置" },
  { key: "stats", label: "数据" },
  { key: "help", label: "帮助" },
];

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-10 text-zinc-400">加载中…</div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get("tab");
    return t === "help" || t === "stats" ? t : "settings";
  });
  const { username, email, avatarUrl } = useUserInfo();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:flex-row sm:px-6">
      <aside className="w-full shrink-0 sm:w-48">
        <div className="flex flex-row gap-2 sm:flex-col">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-4 py-2.5 text-left text-sm font-medium transition ${
                tab === t.key
                  ? "bg-orange-600 text-white"
                  : "text-zinc-600 hover:bg-orange-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1">
        {tab === "settings" && <SettingsTab username={username} email={email} avatarUrl={avatarUrl} />}
        {tab === "stats" && <StatsTab />}
        {tab === "help" && <HelpTab />}
      </main>
    </div>
  );
}

function SettingsTab({
  username,
  email,
  avatarUrl,
}: {
  username: string;
  email: string;
  avatarUrl: string;
}) {
  const [nameInput, setNameInput] = useState(username);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function flash(m: string, isErr = false) {
    if (isErr) {
      setErr(m);
      setMsg("");
    } else {
      setMsg(m);
      setErr("");
    }
  }

  async function saveUsername() {
    const e = await updateUsername(nameInput);
    flash(e ?? "用户名已更新");
  }

  async function onPickAvatar(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    flash("");
    try {
      const url = await uploadAvatar(f);
      const e = await updateAvatarUrl(url);
      if (e) flash(e, true);
      else flash("头像已更新");
    } catch (e) {
      flash(e instanceof Error ? e.message : String(e), true);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">设置</h1>

      {msg && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
          {msg}
        </p>
      )}
      {err && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>
      )}

      {/* 头像 */}
      <section className="rounded-2xl border border-zinc-100 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-700">头像</h2>
        <div className="mt-3 flex items-center gap-4">
          <UserAvatar name={username || email} url={avatarUrl} size={64} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            {uploading ? "上传中…" : "更换头像"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPickAvatar(e.target.files?.[0])}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          未上传头像时，默认显示用户名的第一个字。
        </p>
      </section>

      {/* 用户名 */}
      <section className="rounded-2xl border border-zinc-100 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-700">用户名</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
          <button
            onClick={saveUsername}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            保存
          </button>
        </div>
      </section>

      {/* 邮箱 */}
      <section className="rounded-2xl border border-zinc-100 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-700">邮箱</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={email}
            readOnly
            className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500"
          />
        </div>
        <p className="mt-2 text-xs text-zinc-400">邮箱作为登录账号，暂不支持修改。</p>
      </section>

      {/* 密码 */}
      <section className="rounded-2xl border border-zinc-100 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-700">密码</h2>
        <div className="mt-3 flex gap-2">
          <input
            type="password"
            value="password"
            readOnly
            className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500"
          />
        </div>
        <p className="mt-2 text-xs text-zinc-400">密码已设置，暂不支持修改。</p>
      </section>
    </div>
  );
}

function StatsTab() {
  const [stats, setStats] = useState<{
    selfStudy: { materials: number; cards: number; mistakes: number };
    classroom: { classes: number };
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/profile/stats")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setStats(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">数据</h1>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <section className="rounded-2xl border border-zinc-100 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-700">自学情况统计</h2>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <StatCard label="语料文章" value={stats?.selfStudy.materials ?? 0} />
          <StatCard label="语料卡片" value={stats?.selfStudy.cards ?? 0} />
          <StatCard label="错题" value={stats?.selfStudy.mistakes ?? 0} />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-100 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-700">班级情况统计</h2>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <StatCard label="加入班级" value={stats?.classroom.classes ?? 0} />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-4 text-center">
      <p className="text-3xl font-bold text-orange-600">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function HelpSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-100 bg-white p-6">
      <h2 className="text-base font-bold text-zinc-900">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-600">
        {children}
      </div>
    </section>
  );
}

function HelpItem({ name, desc }: { name: string; desc: string }) {
  return (
    <div>
      <p className="font-medium text-zinc-800">{name}</p>
      <p className="text-zinc-500">{desc}</p>
    </div>
  );
}

function HelpStep({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
        {n}
      </span>
      <span className="text-zinc-600">{children}</span>
    </div>
  );
}

function HelpTab() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">帮助</h1>

      <HelpSection title="LinguaLab 是什么">
        <p>
          LinguaLab 是一个面向中文母语者的外语学习平台，围绕「把读过的外语，变成能说的外语」这一核心思路，
          提供<b>自学模式</b>与<b>课堂模式</b>两种用法。目前支持<b>西班牙语</b>和<b>英语</b>两种目标语言。
        </p>
        <p>
          界面均为中文；学习语言不再是账户级设置，而是<b>按素材自动识别</b>（导入的英语材料就按英语处理），
          口语练习时可手动选择练习语言。
        </p>
      </HelpSection>

      <HelpSection title="自学模式（适合自学者）">
        <HelpItem
          name="语料库"
          desc="粘贴一篇文章，AI 自动识别语言、判断话题与难度，并提取关键词、地道表达和口语练习问题，建成你的专属语料库。可在语料库按语言（英语/西语）筛选。"
        />
        <HelpItem
          name="口语练习"
          desc="自由练习：选一个话题，AI 考官围绕你的语料由浅入深提问，支持语音回答，结束后给出润色建议；考题模式：参考 SIELE 口语考试抽题、限时录音。练习前先在页面顶部选好练习语言。"
        />
        <HelpItem
          name="错题本"
          desc="把口语练习里的润色建议中「错误 → 正确」的条目加入错题本，再用口译练习反复巩固，直到掌握。"
        />
        <HelpItem
          name="写作润色"
          desc="（建设中）把写的外语改得地道，并说明为什么。"
        />
      </HelpSection>

      <HelpSection title="课堂模式">
        <p className="font-semibold text-zinc-800">教师</p>
        <HelpItem
          name="班级管理"
          desc="创建班级获得邀请码，把邀请码发给学生；审批学生的入班申请，还可指定其他教师。"
        />
        <HelpItem
          name="必读文章"
          desc="发布必读文章并设置起止时间；文章语言在发布时自动识别，并标注在班级上。"
        />
        <HelpItem
          name="勾画批注与划线出题"
          desc="进入文章选中原文即可勾画词汇、添加批注；针对选中句子「划线出题」，题目发布后学生可见并作答。"
        />
        <HelpItem
          name="课后作业（阅读题）"
          desc="查看全班对划线题目的作答，写批改留言；学生提交后会收到通知。"
        />
        <HelpItem
          name="笔头作业"
          desc="发布笔头作业（标题 + 内容 + 截止时间），查看学生提交、写评语、打分并查看未交名单。"
        />
        <HelpItem
          name="辅助备课"
          desc="进入文章的「备课模式」，勾画重点词汇、批注后，点击「辅助备课」选择格式（PPT/Word）、题型与数量，AI 据此生成可下载的教学课件。"
        />

        <p className="pt-4 font-semibold text-zinc-800">学生</p>
        <HelpItem
          name="加入班级"
          desc="在「课堂模式」里输入邀请码加入班级，选择「以学生身份」，等待教师审批通过后即可开始。"
        />
        <HelpItem
          name="必读文章"
          desc="阅读教师发布的必读文章，可在原文上勾画生词、添加批注。"
        />
        <HelpItem
          name="课后作业（阅读题）"
          desc="回答教师划线的题目，提交后查看教师的批改留言。"
        />
        <HelpItem
          name="笔头作业"
          desc="按时完成笔头作业并提交文字，之后查看教师的评语和分数。"
        />
        <HelpItem
          name="课外练习"
          desc="（建设中）完成教师布置的课外口语练习任务。"
        />
      </HelpSection>

      <HelpSection title="推荐使用流程">
        <div className="space-y-3">
          <p className="font-semibold text-zinc-800">自学者</p>
          <HelpStep n={1}>在「语料库」导入一篇想学的文章，AI 自动提取学习素材。</HelpStep>
          <HelpStep n={2}>进入「口语练习」，选语言、选话题，和 AI 考官对话开口练习。</HelpStep>
          <HelpStep n={3}>结束后查看润色建议，把易错点加入「错题本」。</HelpStep>
          <HelpStep n={4}>回到「错题本」做口译练习，反复巩固直到掌握。</HelpStep>

          <p className="pt-2 font-semibold text-zinc-800">教师</p>
          <HelpStep n={1}>创建班级，把邀请码发给学生，审批入班。</HelpStep>
          <HelpStep n={2}>发布「必读文章」，点进文章划线出题、勾画批注。</HelpStep>
          <HelpStep n={3}>发布「笔头作业」，设置截止时间。</HelpStep>
          <HelpStep n={4}>需要课件时，进入文章「备课模式」→「辅助备课」生成 PPT/Word。</HelpStep>
          <HelpStep n={5}>在「课后作业」查看学生作答与提交，批改留言、打分。</HelpStep>

          <p className="pt-2 font-semibold text-zinc-800">学生</p>
          <HelpStep n={1}>输入邀请码加入班级，等待教师审批。</HelpStep>
          <HelpStep n={2}>阅读「必读文章」，勾画生词、回答老师题目。</HelpStep>
          <HelpStep n={3}>按时完成「笔头作业」并提交。</HelpStep>
          <HelpStep n={4}>查看教师批改与评语，在右上角铃铛里收到通知。</HelpStep>
        </div>
      </HelpSection>
    </div>
  );
}
