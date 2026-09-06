import type { SupabaseClient } from "@supabase/supabase-js";

export type ClassroomRole = "teacher" | "student";

export async function getClassroomRole(
  supabase: SupabaseClient,
  classroomId: string,
  userId: string,
): Promise<ClassroomRole | null> {
  const { data } = await supabase
    .from("classroom_members")
    .select("role")
    .eq("classroom_id", classroomId)
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();
  return data?.role === "teacher" || data?.role === "student"
    ? data.role
    : null;
}

export function canManageAssignments(role: ClassroomRole): boolean {
  return role === "teacher";
}
