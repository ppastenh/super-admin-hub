-- ============================================================================
-- SUPER-ADMIN-HUB — profiles + owner de box como cuenta real de Auth
--                   (proyecto WODPLACE / wiwpaekdykxernegicdv)
-- ----------------------------------------------------------------------------
-- Igual que las migraciones anteriores del panel (ver crossfit-dash-pro,
-- 20260830190000_wodplace_admin_panel_port.sql): este archivo NO lo aplica el
-- CLI. Se pega y se corre UNA sola vez en el SQL Editor de Supabase del
-- proyecto WODPLACE (wiwpaekdykxernegicdv).
--
-- Correr PRIMERO supabase/diagnostics/inspect_before_migration.sql y revisar
-- el resultado (sobre todo el punto 1: triggers en auth.users).
--
-- Todo es ADITIVO e IDEMPOTENTE: IF NOT EXISTS / IF EXISTS / DO-blocks que
-- chequean el estado antes de actuar. Correrla dos veces no rompe nada.
--
-- Qué hace:
--   1. Crea public.profiles (id -> auth.users.id, email, created_at) si no
--      existe. Si ya existe con otra forma, sólo agrega columnas que falten.
--   2. RLS: cada usuario lee su propio profile; un super_admin (public.user_roles)
--      lee todos. El panel lo necesita para: (a) mostrar el email del dueño de
--      un box pendiente y (b) resolver el form "Otorgar permiso" por email.
--   3. Trigger z_sync_profile_from_auth en auth.users que copia el email a
--      profiles en cada alta. Nombre z_... para correr DESPUÉS de cualquier
--      on_auth_user_created ya existente; ON CONFLICT DO UPDATE para no chocar.
--   4. Backfill de los usuarios que ya existen en auth.users.
--   5. boxes.owner_user_id: pasa de TEXT (-> wodplace_users.id) a UUID
--      (-> auth.users.id). El dueño de un box tiene que ser una cuenta real de
--      Supabase Auth para poder loguearse en este panel y recibir el rol
--      'box_admin' al ser aprobado. Los datos actuales de boxes son de prueba.
--
-- SUPUESTO (confirmado por el diagnóstico): public.user_roles tiene
--   (user_id uuid, role text) y usa el valor role = 'super_admin'.
-- ============================================================================

begin;

-- 1. Tabla -------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

-- Si ya existía con otra forma, garantizamos las columnas que usa el panel.
alter table public.profiles
  add column if not exists email      text,
  add column if not exists created_at timestamptz not null default now();

-- Búsqueda case-insensitive por email (form "Otorgar permiso").
create index if not exists profiles_email_lower_idx on public.profiles (lower(email));

-- 2. RLS -------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles: user reads own"        on public.profiles;
drop policy if exists "profiles: super_admin reads all" on public.profiles;
drop policy if exists "profiles: user updates own"      on public.profiles;

create policy "profiles: user reads own" on public.profiles
  for select to authenticated
  using (auth.uid() = id);

create policy "profiles: super_admin reads all" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'super_admin'
    )
  );

create policy "profiles: user updates own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- 3. Trigger: copiar email de auth.users -> profiles -----------------------
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

revoke all on function public.sync_profile_from_auth() from public, anon, authenticated;

drop trigger if exists z_sync_profile_from_auth on auth.users;
create trigger z_sync_profile_from_auth
  after insert on auth.users
  for each row execute function public.sync_profile_from_auth();

-- 4. Backfill de usuarios existentes --------------------------------------
insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
on conflict (id) do nothing;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is distinct from u.email;

-- 5. boxes.owner_user_id : text (-> wodplace_users) ==> uuid (-> auth.users) --
-- El dueño de un box tiene que ser una cuenta real de Supabase Auth (para
-- loguearse en el panel y recibir user_roles.role = 'box_admin' al aprobarse).
do $$
declare
  col_type text;
  fk_name  text;
begin
  select data_type into col_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'boxes' and column_name = 'owner_user_id';

  if col_type is null then
    raise notice 'boxes.owner_user_id no existe: se omite la conversion';

  elsif col_type = 'uuid' then
    raise notice 'boxes.owner_user_id ya es uuid: se omite la conversion';

  else
    -- soltar cualquier FK que cuelgue de owner_user_id (nombre desconocido)
    for fk_name in
      select con.conname
      from pg_constraint con
      where con.conrelid = 'public.boxes'::regclass
        and con.contype  = 'f'
        and (
          select a.attname
          from pg_attribute a
          where a.attrelid = con.conrelid and a.attnum = con.conkey[1]
        ) = 'owner_user_id'
    loop
      execute format('alter table public.boxes drop constraint %I', fk_name);
    end loop;

    -- permitir NULL para que la FK nueva pueda ser ON DELETE SET NULL
    execute 'alter table public.boxes alter column owner_user_id drop not null';

    -- text -> uuid. '' pasa a NULL. Si hubiera texto NO uuid la conversion
    -- falla: en ese caso son filas de prueba -> TRUNCATE public.boxes y reintentar.
    execute 'alter table public.boxes
               alter column owner_user_id type uuid
               using nullif(btrim(owner_user_id), '''')::uuid';
  end if;
end $$;

-- FK nueva -> auth.users (idempotente por nombre)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.boxes'::regclass
      and conname  = 'boxes_owner_user_id_fkey'
  ) then
    alter table public.boxes
      add constraint boxes_owner_user_id_fkey
      foreign key (owner_user_id) references auth.users(id) on delete set null;
  end if;
end $$;

create index if not exists boxes_owner_user_id_idx on public.boxes (owner_user_id);

commit;
