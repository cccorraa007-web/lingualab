import Link from "next/link";

export default function Placeholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center justify-center px-4 py-24 text-center">
      <span className="mb-4 inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
        开发中
      </span>
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        {title}
      </h1>
      <p className="mt-3 max-w-md text-zinc-600">{description}</p>
      <Link
        href="/"
        className="mt-8 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
      >
        返回首页
      </Link>
    </div>
  );
}
