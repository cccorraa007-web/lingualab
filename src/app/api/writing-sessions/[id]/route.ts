import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getUserClient(request); if (!auth) return unauthorized(); const { id } = await params;
  const { data, error } = await auth.client.from("writing_sessions").select("*").eq("id", id).eq("user_id", auth.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return data ? NextResponse.json({ session: data }) : NextResponse.json({ error: "记录不存在" }, { status: 404 });
}
