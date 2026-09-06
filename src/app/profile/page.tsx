"use client";

import { useEffect, useRef, useState } from "react";
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
  const [tab, setTab] = useState<Tab>("settings");
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

function HelpTab() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">帮助</h1>
      <div className="rounded-2xl border border-dashed border-zinc-200 p-10 text-center text-zinc-400">
        使用文档即将上线，敬请期待
      </div>
    </div>
  );
}
