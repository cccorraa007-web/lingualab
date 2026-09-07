alter table public.notifications
  add column if not exists assignment_id uuid references public.classroom_assignments(id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('submission', 'feedback', 'new_assignment'));

create index if not exists idx_notifications_assignment
  on public.notifications(assignment_id);

NOTIFY pgrst, 'reload schema';
