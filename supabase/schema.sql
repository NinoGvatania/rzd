-- Запустить в Supabase Dashboard → SQL Editor → New query → Run.
-- Создаёт таблицу audits с RLS: каждый инспектор видит и редактирует только свои записи.

create table if not exists public.audits (
  id           text        primary key,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  created_at   bigint      not null,
  data         jsonb       not null,
  inserted_at  timestamptz not null default now()
);

create index if not exists audits_user_created_idx
  on public.audits (user_id, created_at desc);

alter table public.audits enable row level security;

drop policy if exists "audits_select_own" on public.audits;
drop policy if exists "audits_insert_own" on public.audits;
drop policy if exists "audits_update_own" on public.audits;
drop policy if exists "audits_delete_own" on public.audits;

create policy "audits_select_own"
  on public.audits for select
  to authenticated
  using (auth.uid() = user_id);

create policy "audits_insert_own"
  on public.audits for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "audits_update_own"
  on public.audits for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "audits_delete_own"
  on public.audits for delete
  to authenticated
  using (auth.uid() = user_id);
