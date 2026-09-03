export interface Topic {
  slug: string;
  name_zh: string;
  name_es: string;
}

export const TOPICS: Topic[] = [
  { slug: "economia-digital", name_zh: "数字经济", name_es: "Economía digital" },
  { slug: "inteligencia-artificial", name_zh: "人工智能", name_es: "Inteligencia artificial" },
  { slug: "internet-redes-sociales", name_zh: "互联网与社交媒体", name_es: "Internet y redes sociales" },
  { slug: "ciberseguridad-privacidad", name_zh: "网络安全与隐私", name_es: "Ciberseguridad y privacidad" },
  { slug: "innovacion-tecnologica", name_zh: "科技创新", name_es: "Innovación tecnológica" },
  { slug: "relaciones-internacionales", name_zh: "国际关系", name_es: "Relaciones internacionales" },
  { slug: "migracion-refugiados", name_zh: "移民与难民", name_es: "Migración y refugiados" },
  { slug: "politica-gobierno", name_zh: "政治与治理", name_es: "Política y gobierno" },
  { slug: "educacion", name_zh: "教育学习", name_es: "Educación" },
  { slug: "empleo-trabajo", name_zh: "就业与职场", name_es: "Empleo y trabajo" },
  { slug: "igualdad-genero", name_zh: "性别与平等", name_es: "Igualdad de género" },
  { slug: "envejecimiento", name_zh: "老龄化", name_es: "Envejecimiento" },
  { slug: "urbanismo-vivienda", name_zh: "城市化与住房", name_es: "Urbanismo y vivienda" },
  { slug: "pobreza-desigualdad", name_zh: "贫困与不平等", name_es: "Pobreza y desigualdad" },
  { slug: "juventud-generaciones", name_zh: "青年与代际", name_es: "Juventud y generaciones" },
  { slug: "cambio-climatico", name_zh: "气候变化", name_es: "Cambio climático" },
  { slug: "contaminacion-ambiente", name_zh: "环境污染", name_es: "Contaminación" },
  { slug: "transicion-energetica", name_zh: "能源转型", name_es: "Transición energética" },
  { slug: "biodiversidad-naturaleza", name_zh: "自然与生物多样性", name_es: "Biodiversidad y naturaleza" },
  { slug: "salud-medicina", name_zh: "医疗健康", name_es: "Salud y medicina" },
  { slug: "salud-mental", name_zh: "心理健康", name_es: "Salud mental" },
  { slug: "salud-publica", name_zh: "公共卫生", name_es: "Salud pública" },
  { slug: "cine-musica", name_zh: "电影与音乐", name_es: "Cine y música" },
  { slug: "literatura-arte", name_zh: "文学与艺术", name_es: "Literatura y arte" },
  { slug: "gastronomia", name_zh: "美食", name_es: "Gastronomía" },
  { slug: "deporte", name_zh: "体育", name_es: "Deporte" },
  { slug: "viajes-transporte", name_zh: "旅行与交通", name_es: "Viajes y transporte" },
  { slug: "tradiciones-festivales", name_zh: "传统与节日", name_es: "Tradiciones y festivales" },
  { slug: "consumo-finanzas", name_zh: "消费与理财", name_es: "Consumo y finanzas" },
  { slug: "idiomas-comunicacion", name_zh: "语言与沟通", name_es: "Idiomas y comunicación" },
];

const TOPIC_MAP: Record<string, string> = Object.fromEntries(
  TOPICS.map((t) => [t.slug, t.name_zh]),
);

export function topicName(slug: string): string {
  return TOPIC_MAP[slug] ?? slug;
}

export function resolveTopicSlug(input: string): string | null {
  const raw = input.trim();
  const q = raw.toLowerCase();
  const hit = TOPICS.find(
    (t) =>
      t.slug === q ||
      t.name_zh === raw ||
      t.name_es.toLowerCase() === q ||
      t.name_zh.includes(raw) ||
      t.name_es.toLowerCase().includes(q) ||
      q.includes(t.slug),
  );
  return hit ? hit.slug : null;
}
