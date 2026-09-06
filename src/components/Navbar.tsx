"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch, useAuth, signOut } from "@/lib/auth";
import { PRODUCT_NAME } from "@/lib/language";
import UserAvatar from "@/components/UserAvatar";

const selfStudyItems = [
  { href: "/corpus", label: "语料库" },
  { href: "/practice", label: "口语练习" },
  { href: "/mistakes", label: "错题本" },
  { href: "/polish", label: "写作润色" },
];

const teachingItems = [{ href: "/teaching", label: "班级" }];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();
  const router = useRouter();
  const username = (user?.user_metadata?.username as string) || user?.email || "";
  const avatarUrl = (user?.user_metadata?.avatar_url as string) || "";
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const isTeaching =
    pathname.startsWith("/teaching") ||
    (pathname === "/login" && next?.startsWith("/teaching"));
  const navItems = isTeaching ? teachingItems : selfStudyItems;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiFetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setUnreadCount(d.unread_count ?? 0);
      })
      .catch(() => {
        if (!cancelled) setUnreadCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

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
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <div className="mr-2 flex items-center gap-0.5 rounded-lg border border-zinc-200 p-0.5">
            <Link
              href="/corpus"
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                !isTeaching
                  ? "bg-orange-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              自学
            </Link>
            <Link
              href="/teaching"
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                isTeaching
                  ? "bg-orange-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              教学
            </Link>
          </div>
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
          {user ? (
            <div className="ml-3 flex items-center gap-2">
              <Link
                href="/notifications"
                title="通知"
                className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/profile" title="个人主页" className="shrink-0">
                <UserAvatar name={username} url={avatarUrl} size={32} />
              </Link>
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
              href={`/login?next=${encodeURIComponent(pathname)}`}
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
            <div className="flex gap-0.5 rounded-lg border border-zinc-200 p-0.5">
              <Link
                href="/corpus"
                onClick={() => setOpen(false)}
                className={`flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium transition ${
                  !isTeaching
                    ? "bg-orange-600 text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                自学
              </Link>
              <Link
                href="/teaching"
                onClick={() => setOpen(false)}
                className={`flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium transition ${
                  isTeaching
                    ? "bg-orange-600 text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                教学
              </Link>
            </div>
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
            {user && (
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-orange-50"
              >
                <span>通知</span>
                {unreadCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            )}
            <Link
              href="/corpus"
              onClick={() => setOpen(false)}
              className="mt-2 block rounded-lg bg-orange-600 px-3 py-2 text-center text-sm font-semibold text-white"
            >
              开始练习
            </Link>
            {user ? (
              <div className="flex items-center justify-between px-3 py-2">
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2"
                >
                  <UserAvatar name={username} url={avatarUrl} size={28} />
                  <span className="truncate text-xs text-zinc-500">
                    {username}
                  </span>
                </Link>
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
                href={`/login?next=${encodeURIComponent(pathname)}`}
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
