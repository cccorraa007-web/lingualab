"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, signOut, useTargetLang, setTargetLang } from "@/lib/auth";
import { LANGS, PRODUCT_NAME, type TargetLang } from "@/lib/language";

const navItems = [
  { href: "/corpus", label: "语料库" },
  { href: "/practice", label: "口语练习" },
  { href: "/mistakes", label: "错题本" },
  { href: "/polish", label: "写作润色" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const lang = useTargetLang();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 border-b border-orange-100 bg-white/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2"
          onClick={() => setOpen(false)}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-sm font-bold text-white">
            {PRODUCT_NAME.charAt(0)}
          </span>
          <span className="text-lg font-bold tracking-tight text-zinc-900">
            {PRODUCT_NAME}
            <span className="ml-1 hidden text-sm font-normal text-zinc-500 sm:inline">
              {LANGS[lang].short}听说训练
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-orange-50 hover:text-orange-700"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/corpus"
            className="ml-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
          >
            开始练习
          </Link>
          {user && (
            <select
              value={lang}
              onChange={(e) => {
                void setTargetLang(e.target.value as TargetLang).then(() =>
                  router.refresh(),
                );
              }}
              className="ml-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs text-zinc-600"
            >
              {(Object.keys(LANGS) as TargetLang[]).map((k) => (
                <option key={k} value={k}>
                  学{LANGS[k].label}
                </option>
              ))}
            </select>
          )}
          {user ? (
            <div className="ml-3 flex items-center gap-2">
              <span className="max-w-[140px] truncate text-xs text-zinc-500">
                {user.email}
              </span>
              <button
                onClick={() => {
                  void signOut().then(() => {
                    router.push("/");
                    router.refresh();
                  });
                }}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                退出
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="ml-3 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              登录
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-orange-50 md:hidden"
          aria-label="切换菜单"
          aria-expanded={open}
        >
          {open ? (
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          )}
        </button>
      </nav>

      {open && (
        <div className="border-t border-orange-100 bg-white md:hidden">
          <div className="mx-auto max-w-6xl space-y-1 px-4 py-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-orange-50"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/corpus"
              onClick={() => setOpen(false)}
              className="mt-2 block rounded-lg bg-orange-600 px-3 py-2 text-center text-sm font-semibold text-white"
            >
              开始练习
            </Link>
            {user ? (
              <div className="flex items-center justify-between px-3 py-2">
                <span className="truncate text-xs text-zinc-500">
                  {user.email}
                </span>
                <button
                  onClick={() => {
                    void signOut().then(() => {
                      setOpen(false);
                      router.push("/");
                      router.refresh();
                    });
                  }}
                  className="text-xs font-medium text-zinc-600 hover:text-orange-600"
                >
                  退出
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="mt-1 block rounded-lg border border-zinc-200 px-3 py-2 text-center text-sm font-medium text-zinc-700"
              >
                登录 / 注册
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
