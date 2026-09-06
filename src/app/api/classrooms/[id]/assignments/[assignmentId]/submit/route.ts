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
  { params }: { params: Promise<{ id: string; assignmentId: string }> },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id, assignmentId } = await params;
  if (!(await myRole(supabase, auth.user.id, id))) {
    return NextResponse.json({ error: "你不是该班级成员" }, { status: 403 });
  }

  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: "提交内容不能为空" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("assignment_submissions")
    .upsert(
      {
        assignment_id: assignmentId,
        user_id: auth.user.id,
        content: body.content.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "assignment_id,user_id" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ submission: data });
}
