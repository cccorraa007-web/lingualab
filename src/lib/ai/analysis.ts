import { chatJSON } from "@/lib/ai/deepseek";
import { langMeta, type TargetLang } from "@/lib/language";

export interface ClassAnalysis {
  frequentWords: { word: string; count: number }[];
  similarIssues: string[];
  teachingFocus: string[];
}

export async function analyzeClassAnswers(input: {
  question: string;
  sentence: string;
  answers: { email: string; answer: string }[];
  annotationWords: string[];
  lang: TargetLang;
}): Promise<ClassAnalysis> {
  const name = langMeta(input.lang).label;

  // 高频勾画词：直接按批注词频统计（精确，无需 AI）。
  const freq = new Map<string, string>();
  for (const w of input.annotationWords) {
    const key = w.trim();
    if (!key) continue;
    const lower = key.toLowerCase();
    if (!freq.has(lower)) freq.set(lower, key);
  }
  const counts = new Map<string, number>();
  for (const w of input.annotationWords) {
    const key = w.trim().toLowerCase();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const frequentWords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([lower, count]) => ({ word: freq.get(lower) ?? lower, count }));

  // 共性错误 / 讲解侧重点：交给 AI 根据学生作答 + 高频词分析。
  const answerText = input.answers
    .map((a) => `${a.email}：${a.answer}`)
    .join("\n");
  const topWords = frequentWords.map((w) => w.word).join("、");

  const result = await chatJSON<{
    similarIssues?: string[];
    teachingFocus?: string[];
  }>([
    {
      role: "system",
      content: `你是一名${name}教师助手，正在分析一个班级学生对某道题目的作答情况，帮教师快速定位共性问题、确定讲解侧重点。只输出合法 JSON，不要输出多余文字。`,
    },
    {
      role: "user",
      content: `请根据以下信息做班级作答情况分析。

【题目句子】
${input.sentence}

【题目】
${input.question}

【学生作答（逐条）】
${answerText || "（暂无学生作答）"}

【学生高频勾画的词】
${topWords || "（无）"}

请输出 JSON：
{
  "similarIssues": ["学生普遍存在的共性问题或错误类型（中文，2~5 条）"],
  "teachingFocus": ["建议的讲解侧重点（中文，2~5 条，结合高频词与共性错误）"]
}`,
    },
  ]);

  return {
    frequentWords,
    similarIssues: Array.isArray(result.similarIssues)
      ? result.similarIssues.filter((s): s is string => typeof s === "string")
      : [],
    teachingFocus: Array.isArray(result.teachingFocus)
      ? result.teachingFocus.filter((s): s is string => typeof s === "string")
      : [],
  };
}
