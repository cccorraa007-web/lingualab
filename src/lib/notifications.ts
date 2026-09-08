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

export async function notifyAssignmentStudents(
  supabase: SupabaseClient,
  classroomId: string,
  assignmentId: string,
  title: string,
): Promise<void> {
  const { data } = await supabase.from("assignment_recipients").select("user_id").eq("assignment_id", assignmentId);
  const rows = (data ?? []).map((recipient) => ({
    user_id: recipient.user_id,
    type: "new_assignment",
    classroom_id: classroomId,
    assignment_id: assignmentId,
    title: `新笔头作业：${title}`,
  }));
  if (rows.length) await supabase.from("notifications").insert(rows);
}

export async function notifyAssignmentTeachers(
  supabase: SupabaseClient,
  classroomId: string,
  assignmentId: string,
  title: string,
): Promise<void> {
  const { data } = await supabase.from("classroom_members").select("user_id").eq("classroom_id", classroomId).eq("role", "teacher").eq("status", "approved");
  const rows = (data ?? []).map((teacher) => ({ user_id: teacher.user_id, type: "submission", classroom_id: classroomId, assignment_id: assignmentId, title }));
  if (rows.length) await supabase.from("notifications").insert(rows);
}

export async function notifyAssignmentStudent(
  supabase: SupabaseClient,
  userId: string,
  classroomId: string,
  assignmentId: string,
  title: string,
): Promise<void> {
  await supabase.from("notifications").insert({ user_id: userId, type: "feedback", classroom_id: classroomId, assignment_id: assignmentId, title });
}

export async function notifyReadingStudents(
  supabase: SupabaseClient,
  classroomId: string,
  readingId: string,
  title: string,
): Promise<void> {
  const { data } = await supabase
    .from("classroom_members")
    .select("user_id")
    .eq("classroom_id", classroomId)
    .eq("role", "student")
    .eq("status", "approved");
  const rows = (data ?? []).map((student) => ({
    user_id: student.user_id,
    type: "new_reading",
    classroom_id: classroomId,
    reading_id: readingId,
    title: `新课前预习：${title}`,
  }));
  if (rows.length) await supabase.from("notifications").insert(rows);
}

export async function notifyTeacherJoinRequest(
  supabase: SupabaseClient,
  classroomId: string,
  joinerName: string,
): Promise<void> {
  const { data: teachers } = await supabase
    .from("classroom_members")
    .select("user_id")
    .eq("classroom_id", classroomId)
    .eq("role", "teacher")
    .eq("status", "approved");
  const rows = (teachers ?? []).map((teacher) => ({
    user_id: teacher.user_id,
    type: "member_request",
    classroom_id: classroomId,
    title: `${joinerName} 申请加入班级，请及时审批`,
  }));
  if (rows.length) await supabase.from("notifications").insert(rows);
}
