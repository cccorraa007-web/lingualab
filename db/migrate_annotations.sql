-- 原文批注表（用户手动高亮/批注）
create table if not exists public.annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  material_id uuid not null references public.materials(id) on delete cascade,
  text text not null,
  color text not null default 'yellow',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_annotations_material on public.annotations(material_id);

alter table public.annotations disable row level security;

NOTIFY pgrst, 'reload schema';
