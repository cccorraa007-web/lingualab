export type TargetLang = "es" | "en";

export const PRODUCT_NAME = "LinguaLab";

export interface LangMeta {
  key: TargetLang;
  label: string;
  short: string;
  brand: string;
  ttsVoice: string;
}

export const LANGS: Record<TargetLang, LangMeta> = {
  es: {
    key: "es",
    label: "西班牙语",
    short: "西语",
    brand: "HablaYa",
    ttsVoice: "Camila",
  },
  en: {
    key: "en",
    label: "英语",
    short: "英语",
    brand: "SpeakUp",
    ttsVoice: "Cindy",
  },
};

export const DEFAULT_LANG: TargetLang = "en";

export function parseTargetLang(v: unknown): TargetLang {
  return v === "en" ? "en" : "es";
}

export function langMeta(lang: TargetLang): LangMeta {
  return LANGS[lang];
}
