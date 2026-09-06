import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { notifyTeachers } from "@/lib/notifications";

export const dynamic = "force-dynamic";

async function isMember(
  supabase: SupabaseClient,
  userId: string,
  classroomId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("classroom_members")
    .select("id")
    .eq("classroom_id", classroomId)
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();
  return Boolean(data);
}

export async function POST(
  request: Request,
  { params }: {
    params: Promise<{ id: string; readingId: string; questionId: string }>;
  },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id, readingId, questionId } = await params;
  if (!(await isMember(supabase, auth.user.id, id))) {
    return NextResponse.json({ error: "你不是该班级成员" }, { status: 403 });
  }

  let body: { answer?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!body.answer?.trim()) {
    return NextResponse.json({ error: "答案不能为空" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("reading_answers")
    .upsert(
      {
        question_id: questionId,
        user_id: auth.user.id,
        email: auth.user.email ?? null,
        answer: body.answer.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "question_id,user_id" },
    )
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
  const name = auth.user.email ?? "学生";
  await notifyTeachers(
    supabase,
    id,
    readingId,
    `${name} 提交了《${reading?.title ?? "作业"}》的作答，快去批改吧`,
  );

  return NextResponse.json({ answer: data });
}
