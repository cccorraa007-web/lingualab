import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: {
    params: Promise<{ id: string; readingId: string; questionId: string }>;
  },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id, readingId, questionId } = await params;

  const { data: membership } = await supabase
    .from("classroom_members")
    .select("role")
    .eq("classroom_id", id)
    .eq("user_id", auth.user.id)
    .eq("status", "approved")
    .maybeSingle();
  const role = membership?.role as string | undefined;
  if (role !== "teacher" && role !== "leader") {
    return NextResponse.json({ error: "没有删除权限" }, { status: 403 });
  }

  const { error } = await supabase
    .from("reading_questions")
    .delete()
    .eq("id", questionId)
    .eq("reading_id", readingId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
