"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function ClassroomSpeakingPage() {
  const params = useParams<{ id: string }>();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href={`/teaching/${params.id}`}
        className="text-sm text-zinc-500 hover:text-orange-600"
      >
        ← 返回班级
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
        口语练习
      </h1>

      <div className="mt-8 rounded-2xl border border-dashed border-zinc-200 p-12 text-center text-zinc-400">
        口语训练功能建设中，敬请期待
      </div>
    </div>
  );
}
