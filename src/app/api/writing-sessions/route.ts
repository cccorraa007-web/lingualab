import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = await getUserClient(request); if (!auth) return unauthorized();
  const { data, error } = await auth.client.from("writing_sessions").select("id, lang, title, assessment, created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(100);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ sessions: data ?? [] });
}
