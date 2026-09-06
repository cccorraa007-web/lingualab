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

export async function POST(
  request: Request,
  { params }: {
    params: Promise<{ id: string; assignmentId: string; submissionId: string }>;
  },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id, submissionId } = await params;
  const role = await myRole(supabase, auth.user.id, id);
  if (role !== "teacher") {
    return NextResponse.json({ error: "只有教师能批改" }, { status: 403 });
  }

  let body: { feedback?: string; score?: number | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const feedback = body.feedback?.trim() || null;
  const score =
    typeof body.score === "number" && Number.isFinite(body.score)
      ? body.score
      : null;

  const { data, error } = await supabase
    .from("assignment_submissions")
    .update({
      feedback,
      score,
      graded_by: auth.user.id,
      graded_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ submission: data });
}
