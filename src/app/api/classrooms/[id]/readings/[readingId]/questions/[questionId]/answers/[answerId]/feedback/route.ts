import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { notifyStudent } from "@/lib/notifications";

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
    params: Promise<{
      id: string;
      readingId: string;
      questionId: string;
      answerId: string;
    }>;
  },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id, readingId, answerId } = await params;
  const role = await myRole(supabase, auth.user.id, id);
  if (role !== "teacher") {
    return NextResponse.json({ error: "只有教师能批改" }, { status: 403 });
  }

  let body: { feedback?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!body.feedback?.trim()) {
    return NextResponse.json({ error: "反馈不能为空" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("reading_answers")
    .update({
      feedback: body.feedback.trim(),
      graded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", answerId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: reading } = await supabase
    .from("classroom_readings")
    .select("title")
    .eq("id", readingId)
    .single();
  if (data?.user_id) {
    await notifyStudent(
      supabase,
      data.user_id,
      id,
      readingId,
      `老师批改了你的《${reading?.title ?? "作业"}》作答，快去看看评价吧`,
    );
  }

  return NextResponse.json({ answer: data });
}
