import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("缺少 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

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

function detectLanguage(text) {
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

async function main() {
  const { data: classrooms, error } = await supabase
    .from("classrooms")
    .select("id, name, lang");
  if (error) {
    console.error("读取班级失败:", error.message);
    process.exit(1);
  }

  let changed = 0;
  for (const c of classrooms ?? []) {
    const { data: readings } = await supabase
      .from("classroom_readings")
      .select("raw_text")
      .eq("classroom_id", c.id)
      .order("created_at", { ascending: true });

    const text = (readings ?? []).map((r) => r.raw_text).join("\n\n");
    if (!text.trim()) continue;

    const lang = detectLanguage(text);
    if (lang !== c.lang) {
      const { error: upErr } = await supabase
        .from("classrooms")
        .update({ lang })
        .eq("id", c.id);
      if (upErr) {
        console.error(`更新 ${c.name} 失败:`, upErr.message);
        continue;
      }
      changed++;
      console.log(`「${c.name}」: ${c.lang} -> ${lang}`);
    }
  }

  console.log(`\n完成，共更新 ${changed} 个班级。`);
}

main();
