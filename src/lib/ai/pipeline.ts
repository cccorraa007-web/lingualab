import { chatJSON } from "./deepseek";
import { TOPICS, resolveTopicSlug } from "@/lib/topics";
import { langMeta, type TargetLang } from "@/lib/language";

export type CardCategory = "keyword" | "expression" | "prompt";

export interface CorpusItem {
  category: CardCategory;
  content: string;
  zh: string | null;
  extra: Record<string, unknown>;
  snippet: string | null;
  snippet_zh: string | null;
}

export interface CorpusResult {
  tags: string[];
  cefr_level: string;
  items: CorpusItem[];
}

function systemPrompt(lang: TargetLang): string {
  const name = langMeta(lang).label;
  return `你是一名专业的${name}教学助手，擅长分析${name}文本，为中文母语学习者提取语言学习素材。你只输出合法的 JSON，不输出任何解释或多余文字。`;
}

function buildUserPrompt(text: string, lang: TargetLang): string {
  const name = langMeta(lang).label;
  const tagList = TOPICS.map((t) => `${t.slug}（${t.name_zh}）`).join("、");
  return `请分析下面的${name}文章，提取学习素材并输出 JSON。

【tags】从以下标签中，选择最贴切的 1~3 个标签（tags 数组）。数组元素必须原样输出「括号前」的 slug（小写、连字符格式，例如 cambio-climatico），禁止输出${name}名称、中文名称或任何自创内容。可选的 slug 列表：
${tagList}

【cefr_level】估算文章难度，取值 A1/A2/B1/B2/C1/C2。

【items】提取语料条目，每条是一个独立卡片，字段：
- category：取值 "keyword"（关键词）、"expression"（地道表达/固定搭配）、"prompt"（口语练习问题）
- content：关键词原文 / 表达短语 / 问题
- zh：中文释义（prompt 类型可为 null）
- extra：按类型不同的补充字段（JSON 对象）：
  * keyword：{ "pos": "词性", "freq": 出现次数 }
  * expression：{ "type": "colocacion/conector/coloquial/expresion", "register": "neutral/formal/informal", "example": "例句", "example_zh": "例句中文" }
  * prompt：{ "useful_chunks": ["可用表达"], "sample_hint": "中文答题思路" }
- snippet：该条目在原文中出现的完整句子（用于定位原文；原文中找不到时填 null）
- snippet_zh：snippet 的中文翻译（snippet 为 null 时填 null）

数量要求：关键词 10~20 个、地道表达 5~15 个、口语练习 2~4 个。

必须严格输出如下结构的合法 JSON（不要 markdown 代码块）：
{
  "tags": [],
  "cefr_level": "",
  "items": []
}

文章内容：
${text}`;
}

export async function processCorpus(
  text: string,
  lang: TargetLang = "es",
): Promise<CorpusResult> {
  const raw = await chatJSON<Partial<CorpusResult>>([
    { role: "system", content: systemPrompt(lang) },
    { role: "user", content: buildUserPrompt(text, lang) },
  ]);

  const rawTags = Array.isArray(raw.tags) ? raw.tags : [];
  const tags = [
    ...new Set(
      rawTags
        .map((t) => (typeof t === "string" ? resolveTopicSlug(t) : null))
        .filter((t): t is string => Boolean(t)),
    ),
  ].slice(0, 3);

  return {
    tags,
    cefr_level: typeof raw.cefr_level === "string" ? raw.cefr_level : "",
    items: Array.isArray(raw.items) ? raw.items : [],
  };
}

export async function translateText(
  text: string,
  lang: TargetLang = "es",
): Promise<string> {
  const name = langMeta(lang).label;
  const result = await chatJSON<{ translation?: string }>([
    {
      role: "system",
      content: `你是专业的${name}-中文翻译。把${name}文章准确、流畅地翻译成中文，保持段落结构，只输出 JSON。`,
    },
    {
      role: "user",
      content: `请把下面的${name}文章完整翻译成中文，保持段落分段（段落之间用换行分隔），输出格式 {"translation": "译文内容"}：\n\n${text}`,
    },
  ]);
  return typeof result.translation === "string" ? result.translation : "";
}
