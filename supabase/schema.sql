-- =============================================================
-- Миграция: роли (инспектор / руководитель / админ), вокзалы, зоны
-- Запустить в Supabase Dashboard → SQL Editor → New query → Run.
-- Идемпотентна — можно запускать поверх предыдущей версии схемы.
-- =============================================================

-- 1. Справочник вокзалов
create table if not exists public.stations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text unique,
  city        text,
  latitude    double precision,
  longitude   double precision,
  created_at  timestamptz not null default now()
);

-- Сид-данные (5 крупных вокзалов). on conflict — чтобы повторный запуск не падал.
insert into public.stations (name, code, city, latitude, longitude) values
  ('Москва Курская',              'MSK-KUR', 'Москва',           55.7575, 37.6606),
  ('Москва Ярославская',          'MSK-YAR', 'Москва',           55.7766, 37.6555),
  ('Москва Ленинградская',        'MSK-LEN', 'Москва',           55.7766, 37.6555),
  ('Москва Казанская',            'MSK-KAZ', 'Москва',           55.7724, 37.6553),
  ('Санкт-Петербург Московский',  'SPB-MSK', 'Санкт-Петербург',  59.9295, 30.3585)
on conflict (code) do nothing;

-- 2. Роли
do $$ begin
  create type public.user_role as enum ('inspector', 'manager', 'admin');
exception when duplicate_object then null;
end $$;

-- 3. Зоны вокзала
do $$ begin
  create type public.station_zone as enum ('entrance', 'tickets', 'flow', 'platforms');
exception when duplicate_object then null;
end $$;

-- 4. Профили пользователей (1:1 с auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.user_role not null default 'inspector',
  station_id  uuid references public.stations(id),
  full_name   text,
  blocked     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 5. Расширение audits новыми полями (RLS будет фильтровать по station_id)
alter table public.audits
  add column if not exists station_id  uuid references public.stations(id),
  add column if not exists zone        public.station_zone,
  add column if not exists latitude    double precision,
  add column if not exists longitude   double precision;

create index if not exists audits_station_created_idx on public.audits (station_id, created_at desc);

-- 6. Лог действий администратора
create table if not exists public.admin_actions (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id) on delete set null,
  action      text not null,
  target      text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);

-- 7. Хелперы для RLS (SECURITY DEFINER, чтобы избежать рекурсии политик)
create or replace function public.current_role() returns public.user_role
  language sql security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.current_station() returns uuid
  language sql security definer set search_path = public as
$$ select station_id from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin() returns boolean
  language sql security definer set search_path = public as
$$ select coalesce((select role from public.profiles where id = auth.uid()) = 'admin', false) $$;

-- 7a. Триггер: автосоздание profiles при регистрации в auth.users.
-- SECURITY DEFINER обходит RLS — надёжнее, чем INSERT от клиента
-- (после signUp у клиента возможны таймпрограммы с JWT).
-- Параметры берутся из options.data при signUp (role, station_id, full_name).
-- Любая ошибка парсинга метадаты → создаётся минимальный inspector-профиль,
-- чтобы signup не падал на 422.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_role_text    text := nullif(new.raw_user_meta_data->>'role', '');
  v_station_text text := nullif(new.raw_user_meta_data->>'station_id', '');
  v_name         text := nullif(new.raw_user_meta_data->>'full_name', '');
  v_role         public.user_role;
  v_station      uuid;
begin
  v_role := case
    when v_role_text in ('inspector', 'manager', 'admin')
      then v_role_text::public.user_role
    else 'inspector'::public.user_role
  end;

  v_station := case
    when v_station_text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then v_station_text::uuid
    else null
  end;

  insert into public.profiles (id, role, station_id, full_name)
  values (new.id, v_role, v_station, v_name)
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Last resort: даже если что-то выше упало — создаём пустой профиль
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 8. RLS включаем на новых таблицах
alter table public.stations      enable row level security;
alter table public.profiles      enable row level security;
alter table public.admin_actions enable row level security;

-- Stations: читают все (включая анонимных — на форме регистрации
-- руководителя нужно показать дропдаун вокзалов до логина), пишут только админы.
drop policy if exists stations_read         on public.stations;
drop policy if exists stations_admin_write  on public.stations;
create policy stations_read on public.stations
  for select to anon, authenticated using (true);
create policy stations_admin_write on public.stations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Profiles: пользователь читает/создаёт свою строку; админ читает и редактирует всех.
drop policy if exists profiles_self_read    on public.profiles;
drop policy if exists profiles_self_insert  on public.profiles;
drop policy if exists profiles_self_update  on public.profiles;
drop policy if exists profiles_admin_read   on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy profiles_self_insert on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy profiles_self_update on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));
create policy profiles_admin_read on public.profiles
  for select to authenticated using (public.is_admin());
create policy profiles_admin_update on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Audits: пересоздаём с учётом ролей.
-- Инспектор — свои; руководитель — свой вокзал; админ — все.
drop policy if exists audits_select_own on public.audits;
drop policy if exists audits_insert_own on public.audits;
drop policy if exists audits_update_own on public.audits;
drop policy if exists audits_delete_own on public.audits;
drop policy if exists audits_select     on public.audits;
drop policy if exists audits_insert     on public.audits;
drop policy if exists audits_update     on public.audits;
drop policy if exists audits_delete     on public.audits;

create policy audits_select on public.audits for select to authenticated using (
  auth.uid() = user_id
  or public.is_admin()
  or (public.current_role() = 'manager' and station_id is not null and station_id = public.current_station())
);
create policy audits_insert on public.audits for insert to authenticated
  with check (auth.uid() = user_id);
create policy audits_update on public.audits for update to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());
create policy audits_delete on public.audits for delete to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- Admin actions: читают только админы.
drop policy if exists admin_actions_admin_read on public.admin_actions;
drop policy if exists admin_actions_actor_insert on public.admin_actions;
create policy admin_actions_admin_read on public.admin_actions
  for select to authenticated using (public.is_admin());
create policy admin_actions_actor_insert on public.admin_actions
  for insert to authenticated with check (public.is_admin() and actor_id = auth.uid());
