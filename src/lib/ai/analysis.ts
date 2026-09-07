import { chatJSON } from "@/lib/ai/deepseek";
import { langMeta, type TargetLang } from "@/lib/language";

export interface StudentReadingStatus {
  email: string;
  summary: string;
}

export interface ReadingClassAnalysis {
  classSummary: string;
  students: StudentReadingStatus[];
}

export async function analyzeReadingClass(input: {
  title: string;
  questions: { sentence: string; question: string }[];
  studentData: {
    email: string;
    answers: { question: string; answer: string; feedback: string }[];
    annotations: { text: string; note: string }[];
  }[];
  lang: TargetLang;
}): Promise<ReadingClassAnalysis> {
  const name = langMeta(input.lang).label;

  const questionsText = input.questions
    .map((q, i) => `${i + 1}. ${q.question}`)
    .join("\n");

  const studentText = input.studentData
    .map((s) => {
      const answers = s.answers
        .map(
          (a) =>
            `- 题目：${a.question}\n  回答：${a.answer}${a.feedback ? `\n  教师批注：${a.feedback}` : ""}`,
        )
        .join("\n");
      const annotations = s.annotations
        .map((a) => `- ${a.text}${a.note ? `（${a.note}）` : ""}`)
        .join("\n");
      return `【学生 ${s.email}】\n作答：\n${answers || "（未作答）"}\n勾画/提问批注：\n${annotations || "（无）"}`;
    })
    .join("\n\n");

  const result = await chatJSON<{
    classSummary?: string;
    students?: { email?: string; summary?: string }[];
  }>([
    {
      role: "system",
      content: `你是一名${name}教师助手，负责分析一个班级对某篇必读文章的阅读与作答情况。你只输出合法 JSON，不输出多余文字。`,
    },
    {
      role: "user",
      content: `请根据下面的信息，生成班级阅读情况分析。

【文章】${input.title}

【老师发布的题目】
${questionsText || "（无题目）"}

【各学生的作答与提问批注】
${studentText || "（暂无学生数据）"}

请输出 JSON：
{
  "classSummary": "班级总体情况（中文，2~4 条要点，概括作答完成度、共性表现、需注意的点）",
  "students": [
    {"email": "学生邮箱", "summary": "该学生的必读文章阅读情况（中文：是否作答、作答质量、教师批注、提问疑惑等，2~3 句）"}
  ]
}

要求：
- students 数组里 email 必须与上面给出的学生邮箱完全一致，一一对应，不要遗漏。
- 只输出 JSON，不要 markdown 代码块。`,
    },
  ]);

  return {
    classSummary:
      typeof result.classSummary === "string" ? result.classSummary : "",
    students: Array.isArray(result.students)
      ? result.students
          .filter(
            (s): s is { email: string; summary: string } =>
              Boolean(s) && typeof s.email === "string",
          )
          .map((s) => ({
            email: s.email,
            summary: typeof s.summary === "string" ? s.summary : "",
          }))
      : [],
  };
}
