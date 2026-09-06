import { chatJSON } from "@/lib/ai/deepseek";
import { langMeta, type TargetLang } from "@/lib/language";

export type QuestionType = "blank" | "choice" | "truefalse" | "qa";

export const QUESTION_TYPE_NAMES: Record<QuestionType, string> = {
  blank: "填空题",
  choice: "选择题",
  truefalse: "判断题",
  qa: "问答题",
};

export interface LessonRequirement {
  format: "pptx" | "docx";
  questionTypes: QuestionType[];
  questionCount: number;
  extra?: string;
}

export interface LessonVocabulary {
  word: string;
  meaning: string;
}

export interface LessonOutline {
  title: string;
  points: string[];
}

export interface LessonExercise {
  type: QuestionType;
  question: string;
  options: string[];
  answer: string;
}

export interface GeneratedLesson {
  title: string;
  objectives: string[];
  vocabulary: LessonVocabulary[];
  outline: LessonOutline[];
  exercises: LessonExercise[];
}

interface LessonInput {
  title: string;
  text: string;
  annotations: { text: string; note: string | null }[];
  questions: { sentence: string; question: string }[];
  lang: TargetLang;
  requirement: LessonRequirement;
}

function systemPrompt(lang: TargetLang): string {
  const name = langMeta(lang).label;
  return `你是一名专业的${name}教师备课助手，擅长根据课文与教师标注，为教师生成可直接使用的教学课件内容。你只输出合法的 JSON，不输出任何解释或多余文字。`;
}

function buildUserPrompt(input: LessonInput): string {
  const name = langMeta(input.lang).label;
  const typeList = input.requirement.questionTypes
    .map((t) => QUESTION_TYPE_NAMES[t])
    .join("、");
  const annotations = input.annotations
    .map((a) => `- ${a.text}${a.note ? `（${a.note}）` : ""}`)
    .join("\n");
  const questions = input.questions
    .map((q) => `- 句子：${q.sentence}；题目：${q.question}`)
    .join("\n");

  return `请根据下面的${name}文章，结合教师标注的重点词汇与已发布的课堂问题，生成一份教学课件内容。输出 JSON。

【文章标题】
${input.title}

【文章正文】
${input.text}

【教师标注的重点词汇（作为教学重点）】
${annotations || "（无）"}

【教师已发布的课堂问题（可参考并融入练习）】
${questions || "（无）"}

【课件要求】
- 题型：${typeList || "填空题、选择题"}，题目均匀分配到所选题型
- 题目总数：约 ${input.requirement.questionCount} 道
- 交付格式：${input.requirement.format === "pptx" ? "PPT 演示文稿" : "Word 文档"}
${input.requirement.extra ? `- 补充要求：${input.requirement.extra}` : ""}

【输出结构 JSON】
{
  "title": "课件标题",
  "objectives": ["教学目标（中文，2~3 条）"],
  "vocabulary": [{"word": "词汇原文", "meaning": "中文释义"}],
  "outline": [{"title": "内容章节标题（${name}）", "points": ["要点（${name}）"]}],
  "exercises": [
    {
      "type": "blank|choice|truefalse|qa",
      "question": "题目（${name}）",
      "options": ["选项A", "选项B"],
      "answer": "参考答案"
    }
  ]
}

字段规则：
- objectives 用中文写，面向教师的备课目标。
- vocabulary 必须优先来自教师标注的重点词汇（可补充少量文内生词），word 用${name}原文、meaning 用中文。
- outline 用于 PPT/Word 的正文讲解，title 与 points 用${name}（可少量夹注中文）。
- exercises 的 type 只能取 blank/choice/truefalse/qa，且只使用要求的题型；数量尽量接近要求总数。
- choice 题 options 至少 3 个、answer 填正确选项字母（如 "B"）；truefalse 的 options 为 ["正确","错误"]、answer 填其一；blank/qa 的 options 为空数组、answer 填参考答案。
- 必须严格输出合法 JSON，不要 markdown 代码块。`;
}

export async function generateLessonContent(
  input: LessonInput,
): Promise<GeneratedLesson> {
  const raw = await chatJSON<Partial<GeneratedLesson>>([
    { role: "system", content: systemPrompt(input.lang) },
    { role: "user", content: buildUserPrompt(input) },
  ]);

  return {
    title: typeof raw.title === "string" && raw.title ? raw.title : input.title,
    objectives: Array.isArray(raw.objectives)
      ? raw.objectives.filter((o): o is string => typeof o === "string")
      : [],
    vocabulary: Array.isArray(raw.vocabulary)
      ? raw.vocabulary
          .filter(
            (v): v is LessonVocabulary =>
              Boolean(v) && typeof v.word === "string",
          )
          .map((v) => ({
            word: v.word,
            meaning: typeof v.meaning === "string" ? v.meaning : "",
          }))
      : [],
    outline: Array.isArray(raw.outline)
      ? raw.outline
          .filter(
            (o): o is LessonOutline =>
              Boolean(o) && typeof o.title === "string",
          )
          .map((o) => ({
            title: o.title,
            points: Array.isArray(o.points)
              ? o.points.filter((p): p is string => typeof p === "string")
              : [],
          }))
      : [],
    exercises: Array.isArray(raw.exercises)
      ? raw.exercises
          .filter(
            (e): e is LessonExercise =>
              Boolean(e) && typeof e.question === "string",
          )
          .map((e) => ({
            type: (["blank", "choice", "truefalse", "qa"].includes(
              e.type,
            )
              ? e.type
              : "qa") as QuestionType,
            question: e.question,
            options: Array.isArray(e.options)
              ? e.options.filter((o): o is string => typeof o === "string")
              : [],
            answer: typeof e.answer === "string" ? e.answer : "",
          }))
      : [],
  };
}
