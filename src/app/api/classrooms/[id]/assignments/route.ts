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
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id } = await params;
  const role = await myRole(supabase, auth.user.id, id);
  if (!role) {
    return NextResponse.json({ error: "你不是该班级成员" }, { status: 403 });
  }

  const { data: assignments, error } = await supabase
    .from("classroom_assignments")
    .select("id, title, content, ends_at, created_by, created_at")
    .eq("classroom_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = assignments ?? [];
  if (list.length === 0) {
    return NextResponse.json({ assignments: [], my_role: role });
  }

  const assignmentIds = list.map((a) => a.id);

  const { data: recipients } = await supabase
    .from("assignment_recipients")
    .select("assignment_id, user_id")
    .in("assignment_id", assignmentIds);

  const { data: submissions } = await supabase
    .from("assignment_submissions")
    .select("assignment_id, user_id")
    .in("assignment_id", assignmentIds);

  const submittedCount: Record<string, number> = {};
  for (const s of submissions ?? []) {
    submittedCount[s.assignment_id] = (submittedCount[s.assignment_id] ?? 0) + 1;
  }
  const recipientCount: Record<string, number> = {};
  const mySubmitted = new Set<string>();
  for (const r of recipients ?? []) {
    recipientCount[r.assignment_id] = (recipientCount[r.assignment_id] ?? 0) + 1;
  }
  for (const s of submissions ?? []) {
    if (s.user_id === auth.user.id) mySubmitted.add(s.assignment_id);
  }

  const enriched = list.map((a) => ({
    ...a,
    recipient_count: recipientCount[a.id] ?? 0,
    submitted_count: submittedCount[a.id] ?? 0,
    my_submitted: mySubmitted.has(a.id),
  }));

  return NextResponse.json({ assignments: enriched, my_role: role });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id } = await params;
  const role = await myRole(supabase, auth.user.id, id);
  if (role !== "teacher") {
    return NextResponse.json({ error: "只有教师能发布作业" }, { status: 403 });
  }

  let body: { title?: string; content?: string; ends_at?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const title = body.title?.trim();
  const content = body.content?.trim();
  if (!title || !content) {
    return NextResponse.json({ error: "缺少作业标题或内容" }, { status: 400 });
  }
  if (!body.ends_at) {
    return NextResponse.json({ error: "请设置截止时间" }, { status: 400 });
  }

  const { data: assignment, error } = await supabase
    .from("classroom_assignments")
    .insert({
      classroom_id: id,
      title,
      content,
      ends_at: new Date(body.ends_at).toISOString(),
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: members } = await supabase
    .from("classroom_members")
    .select("user_id, email")
    .eq("classroom_id", id)
    .eq("status", "approved");

  const rows = (members ?? []).map((m) => ({
    assignment_id: assignment.id,
    user_id: m.user_id,
    email: m.email ?? null,
  }));
  if (rows.length > 0) {
    await supabase.from("assignment_recipients").insert(rows);
  }

  return NextResponse.json({ assignment });
}
