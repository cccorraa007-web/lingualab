import { chatJSON, chatText, type ChatMessage } from "./deepseek";
import { langMeta, type TargetLang } from "@/lib/language";

export interface PolishItem {
  original: string;
  revised: string;
  reason: string;
  example: string;
  error_type: string;
  wrong: string;
  correct: string;
}

function examinerSystem(lang: TargetLang): string {
  const name = langMeta(lang).label;
  return `你是一名${name}口语考官，正在引导一位中文母语学习者练习${name}口语。

规则：
1. 全程用${name}提问和交流。
2. 根据提供的语料内容提问，问题要与语料紧密相关。
3. 由浅入深：先问简单、具体的问题，逐步过渡到抽象、开放的观点类问题。
4. 自然地融入语料中的关键词和地道表达，引导学习者使用它们。
5. 对学习者的回答，先简短回应（肯定或温和纠正），再提出下一个问题。
6. 每次只输出一个回复（简短回应 + 一个问题），不要一次问多个问题。`;
}

function polishSystem(lang: TargetLang): string {
  const name = langMeta(lang).label;
  const chinglish = `中式${langMeta(lang).short}`;
  return `你是${name}教学专家，擅长帮助中文母语学习者把口语表达改得地道、流畅、丰富。

请分析学习者的口语回答，对每处需要改进的表达输出：
- original：学习者原句
- revised：润色后的句子（修正语法和用词错误，并适当扩写、转换表达，使其更流畅更地道）
- reason：中文解释（说明改了什么、为什么这样更地道）
- example：一个 AI 生成的地道参考回答，示范正确用法（可适当扩写，展示更丰富自然的表达）
- error_type：核心错误的类型，取值：介词搭配 / 比较结构 / 单词误用 / 动词搭配 / 冠词 / 时态 / 语序 / 性数错误 / ${chinglish} / 其他。其中「性数错误」指形容词、冠词、代词与名词的性（阴阳性）或数（单复数）不一致；「${chinglish}」指直译中文造成的别扭表达
- wrong：错误的核心部分，要完整到能独立说明这个错误。搭配类错误（介词/动词/冠词搭配）要包含核心词与介词/冠词（例如「diferencia en」而不是只写「en」）；单词误用则写错词本身；若只是扩写优化而无明确错误则为空字符串
- correct：对应的正确部分（例如「diferencia entre」）；同上可为空

输出 JSON：{"polish": [{"original": "...", "revised": "...", "reason": "...", "example": "...", "error_type": "介词搭配", "wrong": "diferencia en", "correct": "diferencia entre"}]}`;
}

export async function chatReply(
  topicContext: string,
  history: ChatMessage[],
  lang: TargetLang = "es",
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: examinerSystem(lang) },
    {
      role: "user",
      content: `以下是与所选话题相关的语料内容，请围绕这些内容设计问题，引导学习者练习：\n\n${topicContext}`,
    },
    ...history,
  ];
  return chatText(messages);
}

export async function polishAnswers(
  history: ChatMessage[],
  lang: TargetLang = "es",
): Promise<PolishItem[]> {
  const userAnswers = history
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n\n");
  const result = await chatJSON<{ polish?: Partial<PolishItem>[] }>([
    { role: "system", content: polishSystem(lang) },
    {
      role: "user",
      content: `以下是学习者的口语回答，请分析并给出润色建议：\n\n${userAnswers}`,
    },
  ]);
  return Array.isArray(result.polish)
    ? result.polish.map((p) => ({
        original: p.original ?? "",
        revised: p.revised ?? "",
        reason: p.reason ?? "",
        example: p.example ?? "",
        error_type: p.error_type || "其他",
        wrong: p.wrong ?? "",
        correct: p.correct ?? "",
      }))
    : [];
}

export interface InterpretingMistake {
  id: string;
  error_type: string;
  wrong: string;
  correct: string;
  example: string | null;
  note: string | null;
}

export async function generateInterpretingPrompt(
  mistake: InterpretingMistake,
  lang: TargetLang = "es",
): Promise<string> {
  const name = langMeta(lang).label;
  const result = await chatJSON<{ prompt?: string }>([
    {
      role: "system",
      content: `你是${name}老师。生成一个简短自然的中文句子作为口译练习的提示。`,
    },
    {
      role: "user",
      content: `请生成一个中文句子，要求：把这个中文句子翻译成${name}时，应该会用到这个${name}表达「${mistake.correct}」。句子要自然、口语化、简短。只输出 JSON {"prompt": "中文句子"}`,
    },
  ]);
  return typeof result.prompt === "string" ? result.prompt : "";
}

export async function evaluateInterpreting(
  mistake: InterpretingMistake,
  prompt: string,
  answer: string,
  lang: TargetLang = "es",
): Promise<{ correct: boolean; feedback: string }> {
  const name = langMeta(lang).label;
  const result = await chatJSON<{ correct?: boolean; feedback?: string }>([
    {
      role: "system",
      content: `你是${name}老师，正在给学习者做口译练习评分。只输出 JSON。`,
    },
    {
      role: "user",
      content: `错题记录：学习者容易把「${mistake.correct}」误用成「${mistake.wrong}」（错误类型：${mistake.error_type}）。

中文提示：${prompt}
学习者口译的${name}：${answer}

请判断学习者是否正确使用了「${mistake.correct}」（而不是「${mistake.wrong}」）：
- 忽略标点符号和大小写差异，只关注核心表达是否正确
- 正确使用了 correct 表达 → correct 为 true，feedback 简短肯定
- 用错了（用了 wrong 或没用 correct）→ correct 为 false，feedback 用中文提示正确说法

输出 JSON：{"correct": true 或 false, "feedback": "反馈"}`,
    },
  ]);
  return {
    correct: result.correct === true,
    feedback: typeof result.feedback === "string" ? result.feedback : "",
  };
}

export async function generateExamQuestion(
  type: string,
  context: string,
  lang: TargetLang = "es",
): Promise<string> {
  const name = langMeta(lang).label;
  const typeDesc: Record<string, string> = {
    t1: "Tarea 1（简单问答）：生成一个与话题相关的简单个人问题，让考生做简短回答（如个人情况、习惯、经历、喜好）。",
    t3: "Tarea 3（情景对话·留言式）：生成一个具体的情景任务，让考生以「留言」的形式完成沟通。常见类型：提要求、拒绝邀请、获取信息、约定（约时间/见面）、取消约定。题目要包含明确的情景设定（我是谁、面对谁、什么场合）和沟通目的。",
    t5: "Tarea 5（观点表达）：生成一个需要考生明确表达观点并论证的开放性问题（如社会热点、利弊分析）。",
  };

  const result = await chatJSON<{ question?: string }>([
    {
      role: "system",
      content: "你是 SIELE 口语考官，负责根据语料内容生成考题。只输出 JSON。",
    },
    {
      role: "user",
      content: `请生成一道 ${typeDesc[type] ?? typeDesc.t1}\n\n可参考的语料内容（口语练习题目）：\n${context}\n\n要求：题目用${name}，情景化、具体、贴近真实考试。只输出 JSON {"question": "题目内容"}`,
    },
  ]);
  return typeof result.question === "string" ? result.question : "";
}
