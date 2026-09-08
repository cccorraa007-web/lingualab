import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

export async function GET(
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

  if (!membership) {
    return NextResponse.json(
      { error: "你不是该班级成员，或尚未通过审批" },
      { status: 403 },
    );
  }
  const myRole = membership.role as "teacher" | "student";

  const { data: classroom, error: cErr } = await supabase
    .from("classrooms")
    .select("*")
    .eq("id", id)
    .single();
  if (cErr || !classroom) {
    return NextResponse.json({ error: "班级不存在" }, { status: 404 });
  }

  const { data: members } = await supabase
    .from("classroom_members")
    .select("id, email, role, status, created_at")
    .eq("classroom_id", id)
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  let pending: unknown[] = [];
  if (myRole === "teacher") {
    const { data: p } = await supabase
      .from("classroom_members")
      .select("id, email, role, status, created_at")
      .eq("classroom_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    pending = p ?? [];
  }

  return NextResponse.json({
    classroom,
    members: members ?? [],
    pending,
    my_role: myRole,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id } = await params;

  const { data: classroom, error: cErr } = await supabase
    .from("classrooms")
    .select("created_by")
    .eq("id", id)
    .maybeSingle();
  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }
  if (!classroom) {
    return NextResponse.json({ error: "班级不存在" }, { status: 404 });
  }
  if (classroom.created_by !== auth.user.id) {
    return NextResponse.json(
      { error: "只有班级创建者能删除班级" },
      { status: 403 },
    );
  }

  await supabase.from("notifications").delete().eq("classroom_id", id);

  const { error: dErr } = await supabase
    .from("classrooms")
    .delete()
    .eq("id", id);
  if (dErr) {
    return NextResponse.json({ error: dErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
