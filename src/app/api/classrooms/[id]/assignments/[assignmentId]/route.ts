import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

async function myRole(
  supabase: SupabaseClient,
  userId: string,
  classroomId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("classroom_members")
    .select("role")
    .eq("classroom_id", classroomId)
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();
  return (data?.role as string) ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; assignmentId: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id, assignmentId } = await params;
  const role = await myRole(supabase, auth.user.id, id);
  if (!role) {
    return NextResponse.json({ error: "你不是该班级成员" }, { status: 403 });
  }

  const { data: assignment, error: aErr } = await supabase
    .from("classroom_assignments")
    .select("id, title, content, ends_at, created_by, created_at")
    .eq("id", assignmentId)
    .eq("classroom_id", id)
    .single();
  if (aErr || !assignment) {
    return NextResponse.json({ error: "作业不存在" }, { status: 404 });
  }

  const { data: members } = await supabase
    .from("classroom_members")
    .select("user_id, email, role")
    .eq("classroom_id", id)
    .eq("status", "approved");

  const { data: recipients } = await supabase
    .from("assignment_recipients")
    .select("user_id")
    .eq("assignment_id", assignmentId);

  const emailByUser = new Map<string, string>();
  const studentIds = new Set<string>();
  for (const m of members ?? []) {
    if (m.email) emailByUser.set(m.user_id, m.email);
    if (m.role === "student") studentIds.add(m.user_id);
  }

  if (role === "student") {
    const { data: my } = await supabase
      .from("assignment_submissions")
      .select("*")
      .eq("assignment_id", assignmentId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    return NextResponse.json({
      assignment,
      my_role: role,
      my_submission: my ?? null,
    });
  }

  const { data: submissions } = await supabase
    .from("assignment_submissions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: true });

  const submittedUserIds = new Set(
    (submissions ?? []).map((s) => s.user_id),
  );
  const missing = (recipients ?? [])
    .filter((r) => studentIds.has(r.user_id) && !submittedUserIds.has(r.user_id))
    .map((r) => ({
      user_id: r.user_id,
      email: emailByUser.get(r.user_id) ?? "",
    }));

  return NextResponse.json({
    assignment,
    my_role: role,
    submissions: (submissions ?? []).map((s) => ({
      ...s,
      email: emailByUser.get(s.user_id) ?? "",
    })),
    missing,
  });
}
