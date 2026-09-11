import { chatJSON } from "@/lib/ai/deepseek";

export interface ClassroomLearningAnalysis {
  summary: string;
  weaknesses: string[];
  frequentErrors: string[];
  commonQuestions: string[];
  generatedAt: string;
}

export async function analyzeClassroomLearning(input: {
  readingEvidence: string[];
  assignmentEvidence: string[];
  mistakeEvidence: string[];
}): Promise<ClassroomLearningAnalysis> {
  const result = await chatJSON<Partial<ClassroomLearningAnalysis>>([
    { role: "system", content: "你是严谨的外语教学学情分析助手。仅根据提供的匿名班级证据归纳，不猜测学生身份，不输出个人隐私，只输出合法 JSON。" },
    { role: "user", content: `请综合以下动态证据生成全班整体学情分析。\n\n【预习提问与作答】\n${input.readingEvidence.join("\n") || "暂无"}\n\n【课后作业评分与反馈】\n${input.assignmentEvidence.join("\n") || "暂无"}\n\n【错题本错误模式】\n${input.mistakeEvidence.join("\n") || "暂无"}\n\n输出 JSON：{"summary":"总体判断与教学建议，2~4句","weaknesses":["共性薄弱点"],"frequentErrors":["高频错误"],"commonQuestions":["常见疑问"]}。合并重复项；证据不足时明确写“暂无足够数据”。` },
  ]);
  const strings = (value: unknown) => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, 8) : [];
  return {
    summary: typeof result.summary === "string" ? result.summary : "暂无足够数据。",
    weaknesses: strings(result.weaknesses),
    frequentErrors: strings(result.frequentErrors),
    commonQuestions: strings(result.commonQuestions),
    generatedAt: new Date().toISOString(),
  };
}
