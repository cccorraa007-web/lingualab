import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
import { getClassroomRole } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getUserClient(request); if (!auth) return unauthorized();
  const { id } = await params;
  if (await getClassroomRole(auth.client, id, auth.user.id) !== "teacher") return NextResponse.json({ error: "只有教师能查看学生档案" }, { status: 403 });
  const { data, error } = await auth.client.rpc("get_classroom_student_learning_stats", { p_classroom_id: id });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ profiles: data ?? [] });
}
