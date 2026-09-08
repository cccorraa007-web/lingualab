import { chatJSON } from "./deepseek";

export interface BatchReviewItem { question_index: number; student_answer: string; reference_answer: string; is_correct: boolean; issues: string; suggested_grade: string; }
export interface BatchReviewResult { student_id: string; items: BatchReviewItem[]; }

export async function compareAssignmentAnswers(reference: string, students: { student_id: string; answer: string }[]): Promise<BatchReviewResult[]> {
  const result = await chatJSON<{ results?: BatchReviewResult[] }>([
    { role: "system", content: "你是严谨的语言教师。只输出合法 JSON，等级只能是 A+、A、B+、B、C+、C、D。" },
    { role: "user", content: `逐题或逐段对照参考答案和学生答案。不得混淆 student_id。输出 {"results":[{"student_id":"","items":[{"question_index":1,"student_answer":"","reference_answer":"","is_correct":true,"issues":"","suggested_grade":"A"}]}]}。\n参考答案：\n${reference.slice(0, 30000)}\n\n学生答案：\n${JSON.stringify(students).slice(0, 70000)}` },
  ]);
  return Array.isArray(result.results) ? result.results : [];
}
