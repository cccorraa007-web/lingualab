"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/auth";

interface Notification {
  id: string;
  type: string;
  classroom_id: string | null;
  reading_id: string | null;
  assignment_id: string | null;
  title: string;
  read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    apiFetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setNotifications(d.notifications ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [reloadKey]);

  async function open(n: Notification) {
    if (!n.read) {
      await apiFetch(`/api/notifications/${n.id}/read`, { method: "POST" });
      load();
    }
    if (n.classroom_id && n.assignment_id) {
      router.push(`/teaching/${n.classroom_id}/assignments/${n.assignment_id}`);
    } else if (n.classroom_id && n.reading_id) {
      router.push(`/teaching/${n.classroom_id}/readings/${n.reading_id}`);
    } else if (n.classroom_id) {
      router.push(`/teaching/${n.classroom_id}/members`);
    }
  }

  async function readAll() {
    await apiFetch("/api/notifications", { method: "POST" });
    load();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">通知</h1>
        {notifications.some((n) => !n.read) && (
          <button
            onClick={readAll}
            className="text-sm text-orange-600 hover:underline"
          >
            全部标为已读
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-2">
        {loading ? (
          <p className="text-center text-zinc-400">加载中…</p>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 p-10 text-center text-zinc-400">
            暂无通知
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => open(n)}
              className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition hover:shadow-md ${
                n.read
                  ? "border-zinc-100 bg-white"
                  : "border-orange-200 bg-orange-50/40"
              }`}
            >
              {!n.read && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900">{n.title}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {new Date(n.created_at).toLocaleString("zh-CN")}
                </p>
              </div>
              <span className="text-xs text-orange-600">查看 →</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
