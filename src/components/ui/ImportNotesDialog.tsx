"use client";

import { useState } from "react";

export interface ImportOption {
  key: string;
  label: string;
  defaultChecked?: boolean;
}

export default function ImportNotesDialog({ open, title, description, options, busy = false, onCancel, onConfirm }: {
  open: boolean;
  title: string;
  description?: string;
  options: ImportOption[];
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (values: Record<string, boolean>) => void;
}) {
  const defaults = () => Object.fromEntries(options.map((item) => [item.key, item.defaultChecked ?? false]));
  const [values, setValues] = useState<Record<string, boolean>>(defaults);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="import-notes-title">
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
      <h2 id="import-notes-title" className="text-lg font-bold text-zinc-900">{title}</h2>
      {description && <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>}
      <div className="mt-5 space-y-3">{options.map((item) => <label key={item.key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3 text-sm text-zinc-700">
        <input type="checkbox" checked={values[item.key] ?? false} onChange={(e) => setValues((current) => ({ ...current, [item.key]: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-orange-600" />
        <span>{item.label}</span>
      </label>)}</div>
      <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => { setValues(defaults()); onCancel(); }} disabled={busy} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm">取消</button><button type="button" onClick={() => { onConfirm(values); setValues(defaults()); }} disabled={busy} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "处理中…" : "确认导入"}</button></div>
    </div>
  </div>;
}
