-- 标签体系重构：细粒度主题标签
-- 1. materials：加 tags，删旧话题字段
alter table public.materials
  add column if not exists tags text[] not null default '{}';
alter table public.materials drop column if exists primary_topic;
alter table public.materials drop column if exists secondary_topics;
alter table public.materials drop column if exists subtopics;

-- 2. corpus_cards：标签归材料所有，去掉 topic 字段
alter table public.corpus_cards drop column if exists topic;

-- 3. 更新标签字典为 30 个细粒度主题
delete from public.topics;
insert into public.topics (slug, name_zh, name_es) values
  ('economia-digital', '数字经济', 'Economía digital'),
  ('inteligencia-artificial', '人工智能', 'Inteligencia artificial'),
  ('internet-redes-sociales', '互联网与社交媒体', 'Internet y redes sociales'),
  ('ciberseguridad-privacidad', '网络安全与隐私', 'Ciberseguridad y privacidad'),
  ('innovacion-tecnologica', '科技创新', 'Innovación tecnológica'),
  ('relaciones-internacionales', '国际关系', 'Relaciones internacionales'),
  ('migracion-refugiados', '移民与难民', 'Migración y refugiados'),
  ('politica-gobierno', '政治与治理', 'Política y gobierno'),
  ('educacion', '教育学习', 'Educación'),
  ('empleo-trabajo', '就业与职场', 'Empleo y trabajo'),
  ('igualdad-genero', '性别与平等', 'Igualdad de género'),
  ('envejecimiento', '老龄化', 'Envejecimiento'),
  ('urbanismo-vivienda', '城市化与住房', 'Urbanismo y vivienda'),
  ('pobreza-desigualdad', '贫困与不平等', 'Pobreza y desigualdad'),
  ('juventud-generaciones', '青年与代际', 'Juventud y generaciones'),
  ('cambio-climatico', '气候变化', 'Cambio climático'),
  ('contaminacion-ambiente', '环境污染', 'Contaminación'),
  ('transicion-energetica', '能源转型', 'Transición energética'),
  ('biodiversidad-naturaleza', '自然与生物多样性', 'Biodiversidad y naturaleza'),
  ('salud-medicina', '医疗健康', 'Salud y medicina'),
  ('salud-mental', '心理健康', 'Salud mental'),
  ('salud-publica', '公共卫生', 'Salud pública'),
  ('cine-musica', '电影与音乐', 'Cine y música'),
  ('literatura-arte', '文学与艺术', 'Literatura y arte'),
  ('gastronomia', '美食', 'Gastronomía'),
  ('deporte', '体育', 'Deporte'),
  ('viajes-transporte', '旅行与交通', 'Viajes y transporte'),
  ('tradiciones-festivales', '传统与节日', 'Tradiciones y festivales'),
  ('consumo-finanzas', '消费与理财', 'Consumo y finanzas'),
  ('idiomas-comunicacion', '语言与沟通', 'Idiomas y comunicación');

NOTIFY pgrst, 'reload schema';
