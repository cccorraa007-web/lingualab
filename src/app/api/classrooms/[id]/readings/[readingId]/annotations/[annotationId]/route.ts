import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: {
    params: Promise<{ id: string; readingId: string; annotationId: string }>;
  },
) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { id, annotationId } = await params;

  const { data: membership } = await supabase
    .from("classroom_members")
    .select("id")
    .eq("classroom_id", id)
    .eq("user_id", auth.user.id)
    .eq("status", "approved")
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "你不是该班级成员" }, { status: 403 });
  }

  const { error } = await supabase
    .from("reading_annotations")
    .delete()
    .eq("id", annotationId)
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
