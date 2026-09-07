import { chatJSON } from "@/lib/ai/deepseek";
import { langMeta, type TargetLang } from "@/lib/language";

export interface AssignmentClassAnalysis { classSummary: string; students: { email: string; summary: string }[]; }

export async function analyzeAssignmentClass(input: { title: string; content: string; lang: TargetLang; students: { email: string; answer: string; feedback: string; grade: string }[] }): Promise<AssignmentClassAnalysis> {
  const result = await chatJSON<{ classSummary?: unknown; students?: { email?: unknown; summary?: unknown }[] }>([
    { role: "system", content: `你是${langMeta(input.lang).label}教师助手，只分析本次笔头作业提交，只输出合法 JSON。` },
    { role: "user", content: `作业：${input.title}\n要求：${input.content}\n\n学生提交：\n${input.students.map((s) => `【${s.email}】\n答案：${s.answer || "未提交文字"}\n等级：${s.grade || "未评分"}\n反馈：${s.feedback || "无"}`).join("\n\n")}\n\n输出 {"classSummary":"中文总体分析，2~4条要点","students":[{"email":"原邮箱","summary":"中文个体分析，2~3句"}]}。邮箱必须原样返回，不遗漏。` },
  ]);
  return { classSummary: typeof result.classSummary === "string" ? result.classSummary : "", students: Array.isArray(result.students) ? result.students.filter((s) => typeof s.email === "string").map((s) => ({ email: String(s.email), summary: typeof s.summary === "string" ? s.summary : "" })) : [] };
}
