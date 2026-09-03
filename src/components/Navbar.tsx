"use client";

import { useState } from "react";
import Link from "next/link";

const navItems = [
  { href: "/corpus", label: "语料库" },
  { href: "/practice", label: "口语练习" },
  { href: "/mistakes", label: "错题本" },
  { href: "/polish", label: "AI 润色" },
  { href: "/slang", label: "方言俗语" },
  { href: "/shadowing", label: "影子跟读" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-orange-100 bg-white/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2"
          onClick={() => setOpen(false)}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-sm font-bold text-white">
            H
          </span>
          <span className="text-lg font-bold tracking-tight text-zinc-900">
            HablaYa
            <span className="ml-1 hidden text-sm font-normal text-zinc-500 sm:inline">
              西语听说训练
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
          </div>
        </div>
      )}
    </header>
  );
}
