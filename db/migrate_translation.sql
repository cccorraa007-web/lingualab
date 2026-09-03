-- 材料全文中文翻译（按需生成并缓存）
alter table public.materials add column if not exists translation text;

NOTIFY pgrst, 'reload schema';
