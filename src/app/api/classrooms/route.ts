import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

function genInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { data: memberships, error } = await supabase
    .from("classroom_members")
    .select("classroom_id, role")
    .eq("user_id", auth.user.id)
    .eq("status", "approved");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (memberships ?? []).map((m) => m.classroom_id);
  if (ids.length === 0) {
    return NextResponse.json({ classes: [] });
  }

  const { data: rooms, error: rErr } = await supabase
    .from("classrooms")
    .select("*")
    .in("id", ids);

  if (rErr) {
    return NextResponse.json({ error: rErr.message }, { status: 500 });
  }

  const roleByClass = new Map(
    (memberships ?? []).map((m) => [m.classroom_id, m.role]),
  );
  const classes = (rooms ?? []).map((room) => ({
    ...room,
    my_role: roleByClass.get(room.id) ?? "student",
    can_delete: room.created_by === auth.user.id,
  }));

  return NextResponse.json({ classes });
}

export async function POST(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  let body: { name?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "缺少班级名称" }, { status: 400 });
  }
  const role = body.role === "student" ? "student" : "teacher";

  const invite_code = genInviteCode();
  const { data: classroom, error: cErr } = await supabase
    .from("classrooms")
    .insert({ name, invite_code, created_by: auth.user.id })
    .select()
    .single();
  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  const { error: mErr } = await supabase.from("classroom_members").insert({
    classroom_id: classroom.id,
    user_id: auth.user.id,
    email: auth.user.email ?? null,
    role,
    status: "approved",
  });
  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  return NextResponse.json({ classroom });
}
