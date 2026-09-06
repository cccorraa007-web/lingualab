import type { SupabaseClient } from "@supabase/supabase-js";

export async function notifyTeachers(
  supabase: SupabaseClient,
  classroomId: string,
  readingId: string,
  title: string,
): Promise<void> {
  const { data: teachers } = await supabase
    .from("classroom_members")
    .select("user_id")
    .eq("classroom_id", classroomId)
    .eq("role", "teacher")
    .eq("status", "approved");
  const rows = (teachers ?? []).map((t) => ({
    user_id: t.user_id,
    type: "submission",
    classroom_id: classroomId,
    reading_id: readingId,
    title,
  }));
  if (rows.length > 0) {
    await supabase.from("notifications").insert(rows);
  }
}

export async function notifyStudent(
  supabase: SupabaseClient,
  userId: string,
  classroomId: string,
  readingId: string,
  title: string,
): Promise<void> {
  await supabase.from("notifications").insert({
    user_id: userId,
    type: "feedback",
    classroom_id: classroomId,
    reading_id: readingId,
    title,
  });
}
