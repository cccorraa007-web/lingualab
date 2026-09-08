import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

function scoreOf(assessment: unknown): number | null {
  if (assessment && typeof assessment === "object") {
    const total = (assessment as { total_score?: unknown }).total_score;
    const parsed = typeof total === "number" ? total : Number(total);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function GET(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;
  const userId = auth.user.id;

  const [{ data: selfMaterials }, { data: sessions }, { data: writing }, { data: mistakes }] =
    await Promise.all([
      supabase
        .from("materials")
        .select("id")
        .eq("user_id", userId)
        .is("reading_id", null),
      supabase
        .from("practice_sessions")
        .select("assessment, duration_seconds, created_at")
        .eq("user_id", userId),
      supabase
        .from("writing_sessions")
        .select("assessment, created_at")
        .eq("user_id", userId),
      supabase
        .from("mistake_book")
        .select("correct_streak, last_reviewed_at")
        .eq("user_id", userId),
    ]);

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const sessionsList = sessions ?? [];
  const scores = sessionsList
    .map((s) => scoreOf(s.assessment))
    .filter((n): n is number => n !== null);
  const durations = sessionsList
    .map((s) => s.duration_seconds)
    .filter((n): n is number => typeof n === "number" && n > 0);

  const writingList = writing ?? [];
  const writingScores = writingList
    .map((w) => scoreOf(w.assessment))
    .filter((n): n is number => n !== null);

  const mistakesList = mistakes ?? [];
  const reviewed = mistakesList.filter((m) => m.last_reviewed_at).map((m) => new Date(m.last_reviewed_at).getTime());

  return NextResponse.json({
    selfReading: { count: selfMaterials?.length ?? 0 },
    speaking: {
      count: sessionsList.length,
      avgScore: scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null,
      avgDuration: durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null,
      last7Days: sessionsList.filter(
        (s) => new Date(s.created_at).getTime() >= sevenDaysAgo,
      ).length,
      lastAt: sessionsList.length
        ? new Date(
            Math.max(...sessionsList.map((s) => new Date(s.created_at).getTime())),
          ).toISOString()
        : null,
    },
    writing: {
      count: writingList.length,
      avgScore: writingScores.length
        ? Math.round((writingScores.reduce((a, b) => a + b, 0) / writingScores.length) * 10) / 10
        : null,
      lastAt: writingList.length
        ? new Date(
            Math.max(...writingList.map((w) => new Date(w.created_at).getTime())),
          ).toISOString()
        : null,
    },
    mistakes: {
      count: mistakesList.length,
      mastering: mistakesList.filter((m) => (m.correct_streak ?? 0) > 0).length,
      lastReviewedAt: reviewed.length
        ? new Date(Math.max(...reviewed)).toISOString()
        : null,
    },
  });
}
