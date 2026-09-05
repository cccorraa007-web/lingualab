-- 多用户接入：启用 RLS + 按 user_id 隔离数据
-- 在 Supabase SQL Editor 里执行。前提：已在 Authentication 里启用邮箱登录。

-- 1) 将 user_id 默认值改为当前登录用户 auth.uid()
alter table public.materials alter column user_id set default auth.uid();
alter table public.corpus_cards alter column user_id set default auth.uid();
alter table public.annotations alter column user_id set default auth.uid();
alter table public.mistake_book alter column user_id set default auth.uid();

-- 2) 启用行级安全 + 按 user_id 隔离策略（每个用户只能读写自己的数据）
alter table public.materials enable row level security;
drop policy if exists "materials_own" on public.materials;
create policy "materials_own" on public.materials for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.corpus_cards enable row level security;
drop policy if exists "corpus_cards_own" on public.corpus_cards;
create policy "corpus_cards_own" on public.corpus_cards for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.annotations enable row level security;
drop policy if exists "annotations_own" on public.annotations;
create policy "annotations_own" on public.annotations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.mistake_book enable row level security;
drop policy if exists "mistake_book_own" on public.mistake_book;
create policy "mistake_book_own" on public.mistake_book for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3) 提示：旧测试数据挂在占位 user_id 上，新用户登录后看不到，属正常现象。
--    如需清空旧数据：delete from public.materials; delete from public.mistake_book; 等。

NOTIFY pgrst, 'reload schema';
