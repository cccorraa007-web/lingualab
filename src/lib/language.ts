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

const NON_LATIN_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff\u0590-\u05ff\u0900-\u097f]/g;
const OTHER_ACCENTS = /[àèìòùâêîôûçäëïöãõåøæœ]/i;

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

export type DetectedLang = TargetLang | "other";

export function detectSupportedLanguage(text: string): DetectedLang {
  const sample = (text || "").slice(0, 20000);

  const nonLatin = countMatches(sample, NON_LATIN_RE);
  const latin = countMatches(sample, /[a-zA-Z]/g);
  const total = latin + nonLatin;
  if (total === 0) return "other";
  if (nonLatin > 0 && nonLatin >= latin * 0.3) return "other";

  const words = sample.toLowerCase().match(/[a-záéíóúüñ]+/g) ?? [];
  const otherAccents = countMatches(sample, OTHER_ACCENTS);
  if (otherAccents >= 3 || (words.length >= 20 && otherAccents >= words.length * 0.02)) {
    return "other";
  }

  let es = 0;
  let en = 0;
  for (const w of words) {
    if (ES_WORDS.has(w)) es++;
    if (EN_WORDS.has(w)) en++;
  }
  const accents = countMatches(sample, ES_ACCENTS);
  es += accents * 2;

  const signal = es + en + accents;
  if (words.length >= 20 && signal < words.length * 0.03) {
    return "other";
  }

  return en > es ? "en" : "es";
}
