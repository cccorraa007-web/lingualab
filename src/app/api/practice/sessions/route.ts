import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { data, error } = await supabase
    .from("practice_sessions")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessions: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  let body: {
    lang?: string;
    topic?: string;
    rounds?: number;
    transcript?: unknown;
    polish?: unknown;
    assessment?: unknown;
    duration_seconds?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!body.topic || !Array.isArray(body.transcript)) {
    return NextResponse.json({ error: "缺少主题或对话内容" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("practice_sessions")
    .insert({
      user_id: auth.user.id,
      lang: body.lang === "en" ? "en" : "es",
      topic: body.topic,
      rounds: Math.max(0, Number(body.rounds) || 0),
      transcript: body.transcript,
      polish: Array.isArray(body.polish) ? body.polish : [],
      assessment: body.assessment ?? null,
      duration_seconds: body.duration_seconds ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session: data });
}
