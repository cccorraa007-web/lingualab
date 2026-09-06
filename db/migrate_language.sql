-- 一、语言改为「按素材自动识别」，不再用账户级目标语言
-- materials：语料库导入的素材语言（es/en）
alter table public.materials add column if not exists lang text not null default 'es';

-- classrooms：教学班语言，由首次导入的必读文章判定
alter table public.classrooms add column if not exists lang text not null default 'es';

-- mistake_book：错题语言，保存时记录，供口译练习使用
alter table public.mistake_book add column if not exists lang text not null default 'es';

NOTIFY pgrst, 'reload schema';
