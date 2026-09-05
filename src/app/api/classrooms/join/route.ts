import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  let body: { invite_code?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const code = body.invite_code?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "请输入邀请码" }, { status: 400 });
  }

  const { data: classroom, error: cErr } = await supabase
    .from("classrooms")
    .select("id, name")
    .eq("invite_code", code)
    .single();
  if (cErr || !classroom) {
    return NextResponse.json({ error: "邀请码无效" }, { status: 404 });
  }

  const role = body.role === "teacher" ? "teacher" : "student";
  const { data: existing } = await supabase
    .from("classroom_members")
    .select("id, status")
    .eq("classroom_id", classroom.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      existing.status === "approved"
        ? { classroom, joined: false, message: "你已在该班级中" }
        : { classroom, joined: false, message: "已提交申请，等待教师审批" },
    );
  }

  const { error: mErr } = await supabase.from("classroom_members").insert({
    classroom_id: classroom.id,
    user_id: auth.user.id,
    email: auth.user.email ?? null,
    role,
    status: "pending",
  });
  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  return NextResponse.json({
    classroom,
    joined: true,
    message: "已提交加入申请，等待教师审批",
  });
}
