export type TargetLang = "es" | "en";

export const PRODUCT_NAME = "LinguaLab";

export interface LangMeta {
  key: TargetLang;
  label: string;
  short: string;
  ttsVoice: string;
}

export const LANGS: Record<TargetLang, LangMeta> = {
  es: {
    key: "es",
    label: "西班牙语",
    short: "西语",
    ttsVoice: "Camila",
  },
  en: {
    key: "en",
    label: "英语",
    short: "英语",
    ttsVoice: "Cindy",
  },
};

export const DEFAULT_LANG: TargetLang = "es";

export function parseTargetLang(v: unknown): TargetLang {
  return v === "en" ? "en" : "es";
}

export function langMeta(lang: TargetLang): LangMeta {
  return LANGS[lang];
}

const ES_WORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al",
  "que", "es", "son", "y", "o", "en", "por", "para", "con", "sin", "se",
  "su", "sus", "no", "más", "muy", "pero", "como", "cuando", "donde",
  "este", "esta", "estos", "estas", "ser", "estar", "tener", "hacer",
  "haber", "hay", "bien", "también", "porque", "entre", "sobre", "cada",
]);

const EN_WORDS = new Set([
  "the", "and", "of", "to", "in", "is", "are", "was", "were", "for", "with",
  "that", "this", "you", "have", "has", "it", "be", "been", "a", "an", "as",
  "at", "by", "on", "or", "from", "not", "but", "they", "we", "he", "she",
  "i", "will", "would", "can", "could", "should", "do", "does", "did", "so",
  "if", "what", "when", "who", "how", "there", "their", "your", "our", "my",
]);

const ES_ACCENTS = /[áéíóúüñ¿¡]/i;

export function detectLanguage(text: string): TargetLang {
  const sample = (text || "").slice(0, 20000);
  const words = sample.toLowerCase().match(/[a-záéíóúüñ]+/g) ?? [];
  let es = 0;
  let en = 0;
  for (const w of words) {
    if (ES_WORDS.has(w)) es++;
    if (EN_WORDS.has(w)) en++;
  }
  const accentCount = (sample.match(ES_ACCENTS) ?? []).length;
  es += accentCount * 2;
  return en > es ? "en" : "es";
}
