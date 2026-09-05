"use client";

import Link from "next/link";
import { useTargetLang } from "@/lib/auth";
import { langMeta, PRODUCT_NAME } from "@/lib/language";

const selfStudyFeatures = [
  { title: "语料库", desc: "导入读过的材料，AI 自动分类、提取关键词和地道表达，建成专属语料库。" },
  { title: "口语练习", desc: "AI 当考官模拟口语考试题，实时语音识别，四维评分，记住常见错误。" },
  { title: "写作润色", desc: "把写的外语改得地道，每条修改都告诉你为什么，并给出参考例句。" },
  { title: "错题本", desc: "沉淀易错点，配合口译练习反复巩固，直到真正掌握。" },
];

const teachingFeatures = [
  { title: "班级管理", desc: "创建班级、邀请码加入、教师审批，支持多名教师与班委。" },
  { title: "必读文章", desc: "教师发布必读文章并设置起止时间，学生按时间窗口阅读。" },
  { title: "阅读勾画与批注", desc: "学生在原文上勾画词汇、批注句子，沉淀个人阅读记录。" },
  { title: "AI 口语与学情", desc: "基于勾画批注生成口语问题，AI 生成学生档案与班级分析（建设中）。" },
];

export default function Home() {
  const lang = useTargetLang();
  const m = langMeta(lang);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="bg-gradient-to-b from-orange-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-orange-600">
            {PRODUCT_NAME}
          </p>
          <h1 className="mt-3 text-5xl font-bold tracking-tight text-zinc-900 sm:text-6xl">
            {m.brand}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-medium text-zinc-700">
            把读过的{m.short}，
            <span className="text-orange-600">变成能说的{m.short}</span>
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-8 text-zinc-600">
            面向中国{m.label}学习者的「输入 → 输出」训练平台，支持自主学习与课堂教学两种模式。
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/corpus"
              className="w-full rounded-lg bg-orange-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-orange-700 sm:w-auto"
            >
              进入自学模式
            </Link>
            <Link
              href="/teaching"
              className="w-full rounded-lg border border-zinc-200 bg-white px-6 py-3 text-base font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 sm:w-auto"
            >
              进入教学模式
            </Link>
          </div>
        </div>
      </section>

      {/* 自学模式 */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-orange-600">
              自学模式
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              把积累变成能力
            </h2>
            <p className="mt-2 max-w-2xl text-zinc-600">
              适合自学者，围绕「读过的材料」做对话、润色、复习，把被动输入转化为主动输出。
            </p>
          </div>
          <Link
            href="/corpus"
            className="rounded-lg border border-orange-300 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50"
          >
            进入自学模式 →
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {selfStudyFeatures.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm"
            >
              <h3 className="font-semibold text-zinc-900">{f.title}</h3>
              <p className="mt-2 text-sm text-zinc-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 教学模式 */}
      <section className="w-full bg-zinc-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
                教学模式
              </span>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
                融入真实课堂
              </h2>
              <p className="mt-2 max-w-2xl text-zinc-600">
                面向教师与学生，围绕班级开展必读、阅读批注与口语训练，让听说练习真正进入课堂。
              </p>
            </div>
            <Link
              href="/teaching"
              className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              进入教学模式 →
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {teachingFeatures.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm"
              >
                <h3 className="font-semibold text-zinc-900">{f.title}</h3>
                <p className="mt-2 text-sm text-zinc-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          现在就开始，把积累变成能力
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-zinc-600">
          无论自学还是课堂，都能在这里把读过的材料变成能说的话。
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/corpus"
            className="rounded-lg bg-orange-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-orange-700"
          >
            进入自学模式
          </Link>
          <Link
            href="/teaching"
            className="rounded-lg border border-zinc-200 bg-white px-6 py-3 text-base font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            进入教学模式
          </Link>
        </div>
      </section>
    </div>
  );
}
