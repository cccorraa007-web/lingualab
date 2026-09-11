import { chatJSON } from "./deepseek";

export interface DictionaryEntry {
  word: string;
  partOfSpeech: string;
  translation: string;
  definitions: string[];
  examples: { text: string; translation: string }[];
}

export async function lookupWord(
  word: string,
  lang: "es" | "en",
): Promise<DictionaryEntry> {
  const langName = lang === "es" ? "西班牙语" : "英语";
  return chatJSON<DictionaryEntry>([
    {
      role: "system",
      content: `你是专业的${langName}词典助手。对用户给出的${langName}单词或短语，用中文解释。只返回 JSON，不要任何多余文字，格式：{"word":"原文","partOfSpeech":"词性(如 名词/动词/形容词/短语等)","translation":"中文释义","definitions":["${langName}释义1","释义2"],"examples":[{"text":"${langName}例句","translation":"中文翻译"}]}。definitions 给出 1-3 条，examples 给出 1-2 条。`,
    },
    { role: "user", content: word },
  ]);
}
