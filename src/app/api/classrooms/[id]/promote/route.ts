import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id } = await params;

  const { data: membership } = await supabase
    .from("classroom_members")
    .select("role")
    .eq("classroom_id", id)
    .eq("user_id", auth.user.id)
    .eq("status", "approved")
    .maybeSingle();
  if (membership?.role !== "teacher") {
    return NextResponse.json({ error: "只有教师能指定角色" }, { status: 403 });
  }

  let body: { member_id?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!body.member_id) {
    return NextResponse.json({ error: "缺少 member_id" }, { status: 400 });
  }

  const role = body.role === "teacher" ? "teacher" : "leader";

  const { error } = await supabase
    .from("classroom_members")
    .update({ role })
    .eq("id", body.member_id)
    .eq("classroom_id", id)
    .eq("status", "approved");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
