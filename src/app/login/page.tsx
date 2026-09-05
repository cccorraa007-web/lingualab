"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp, setTargetLang, type UserRole } from "@/lib/auth";
import { LANGS, PRODUCT_NAME, type TargetLang } from "@/lib/language";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lang, setLang] = useState<TargetLang>("es");
  const [role, setRole] = useState<UserRole>("student");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setNotice("");
    if (!email.trim() || !password) {
      setError("请填写邮箱和密码");
      return;
    }
    setLoading(true);
    if (mode === "signup") {
      const { error: err, needsConfirm } = await signUp(
        email.trim(),
        password,
        lang,
        role,
      );
      setLoading(false);
      if (err) {
        setError(err);
        return;
      }
      if (needsConfirm) {
        setNotice("注册成功！请查收邮箱里的确认邮件，点击确认后再登录。");
        setMode("signin");
        return;
      }
      router.push("/corpus");
      router.refresh();
      return;
    }
    const err = await signIn(email.trim(), password);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    await setTargetLang(lang);
    router.push("/corpus");
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          {mode === "signin" ? "登录" : "注册"} {PRODUCT_NAME}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          登录后你的语料库、错题本、练习记录都只属于你自己
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-100 bg-white p-6">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-600">
              我要学
            </label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(Object.keys(LANGS) as TargetLang[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setLang(k)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    lang === k
                      ? "border-orange-400 bg-orange-50 text-orange-700"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {LANGS[k].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-600">
              我的身份
            </label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("student")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  role === "student"
                    ? "border-orange-400 bg-orange-50 text-orange-700"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                学生
              </button>
              <button
                type="button"
                onClick={() => setRole("teacher")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  role === "teacher"
                    ? "border-orange-400 bg-orange-50 text-orange-700"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                教师
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-600">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-600">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              placeholder={mode === "signup" ? "至少 6 位" : ""}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
              {notice}
            </p>
          )}

          <button
            onClick={() => void submit()}
            disabled={loading}
            className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? "处理中…" : mode === "signin" ? "登录" : "注册"}
          </button>
        </div>
      </div>

      <p className="text-center text-sm text-zinc-500">
        {mode === "signin" ? (
          <>
            还没有账号？{" "}
            <button
              onClick={() => setMode("signup")}
              className="font-medium text-orange-600 hover:underline"
            >
              去注册
            </button>
          </>
        ) : (
          <>
            已有账号？{" "}
            <button
              onClick={() => setMode("signin")}
              className="font-medium text-orange-600 hover:underline"
            >
              去登录
            </button>
          </>
        )}
      </p>
    </div>
  );
}
