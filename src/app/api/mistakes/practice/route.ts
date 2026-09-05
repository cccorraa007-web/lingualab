import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { generateInterpretingPrompt } from "@/lib/ai/practice";
import type { InterpretingMistake } from "@/lib/ai/practice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { data, error } = await supabase
    .from("mistake_book")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("wrong_count", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json({ done: true, reason: "empty" });
  }

  const today = new Date().toDateString();
  const candidates = data.filter(
    (m) =>
      !m.last_reviewed_at ||
      new Date(m.last_reviewed_at).toDateString() !== today,
  );

  if (candidates.length === 0) {
    return NextResponse.json({ done: true, reason: "reviewed" });
  }

  const mistake = candidates[0] as InterpretingMistake;
  const prompt = await generateInterpretingPrompt(mistake, auth.user.lang);
  return NextResponse.json({ done: false, mistake, prompt });
}
