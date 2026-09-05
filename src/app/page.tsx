import Link from "next/link";

const pains = [
  {
    title: "会做题 ≠ 会交流",
    desc: "语法题刷得飞起，一到真实场景就卡壳、脑子一片空白。",
  },
  {
    title: "读得多 ≠ 说得出",
    desc: "背了不少单词和文章，开口还是满嘴中式西语、不地道。",
  },
  {
    title: "标准西语 ≠ 当地口音",
    desc: "课本西语，听不懂街头俚语和不同国家的 voseo、口音差异。",
  },
];

const features = [
  {
    href: "/corpus",
    num: "1",
    title: "语料库",
    subtitle: "Corpus",
    desc: "导入读过的材料，AI 自动按话题分类、提取关键词和地道表达，建成你的专属语料库。",
  },
  {
    href: "/practice",
    num: "2",
    title: "口语练习",
    subtitle: "Hablar",
    desc: "AI 当考官模拟 DELE/SIELE 口语题，四维评分，记住你的常见错误，下次刻意纠正。",
  },
  {
    href: "/polish",
    num: "3",
    title: "写作润色",
    subtitle: "Pulir",
    desc: "基于真实语料的改写，按商务/日常等场景切换语气，每条修改都告诉你为什么。",
  },
];

const steps = [
  {
    title: "导入材料",
    desc: "粘贴文章、贴链接、上传音频，把你读过、听过的都喂进来。",
  },
  {
    title: "自动建库",
    desc: "AI 按话题分类，提取关键词、地道表达和口语练习素材。",
  },
  {
    title: "转化输出",
    desc: "对话、润色，把被动的输入变成能说的西语。",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="bg-gradient-to-b from-orange-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-5xl">
            把读过的西语，
            <span className="text-orange-600">变成能说的西语</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
            面向中国西语学习者的「输入 → 输出」训练平台。自动建立你的专属语料库，
            围绕它做对话、润色，摆脱「会做题、说不出」的困境。
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/corpus"
              className="w-full rounded-lg bg-orange-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-orange-700 sm:w-auto"
            >
              开始建立语料库
            </Link>
            <Link
              href="#how"
              className="w-full rounded-lg border border-zinc-200 bg-white px-6 py-3 text-base font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 sm:w-auto"
            >
              了解怎么做
            </Link>
          </div>
        </div>
      </section>

      {/* 痛点 */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          你是不是也有这些困惑？
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {pains.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-zinc-100 bg-zinc-50 p-6"
            >
              <h3 className="text-lg font-semibold text-zinc-900">{p.title}</h3>
              <p className="mt-2 text-zinc-600">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 功能模块 */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          三大功能，打通听说
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-600">
          语料库是地基，其余功能都围绕它，把积累转化成真正会用的能力。
        </p>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="group rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-sm font-bold text-orange-700">
                {f.num}
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">
                {f.title}
                <span className="ml-2 text-sm font-normal text-zinc-400">
                  {f.subtitle}
                </span>
              </h3>
              <p className="mt-2 text-zinc-600">{f.desc}</p>
              <span className="mt-4 inline-block text-sm font-medium text-orange-600 group-hover:text-orange-700">
                了解更多 →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 流程 */}
      <section id="how" className="bg-zinc-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            三步，从输入到输出
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <div
                key={s.title}
                className="rounded-2xl border border-zinc-100 bg-white p-6"
              >
                <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-sm font-bold text-white">
                  {i + 1}
                </div>
                <h3 className="text-lg font-semibold text-zinc-900">
                  {s.title}
                </h3>
                <p className="mt-2 text-zinc-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 收尾 CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          现在就开始，把积累变成能力
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-zinc-600">
          粘贴一篇文章，看看它如何自动变成你的语料库。
        </p>
        <Link
          href="/corpus"
          className="mt-8 inline-block rounded-lg bg-orange-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-orange-700"
        >
          免费开始
        </Link>
      </section>
    </div>
  );
}
