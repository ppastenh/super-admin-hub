-- ============================================================================
-- DIAGNÓSTICO — correr en el SQL Editor de WODPLACE (wiwpaekdykxernegicdv)
-- ANTES de aplicar 20260831180000_profiles_for_super_admin_hub.sql
-- Solo lee catálogos. No modifica nada.
--
-- Una sola consulta: devuelve TODO junto en un resultado con columnas
--   ord | check | result
-- Filas con result = '(ninguno)' / '(no existe)' significan que ese objeto
-- todavía no está en la base.
-- ============================================================================

-- 1. Triggers sobre auth.users (¿ya hay un on_auth_user_created?)
select 1 as ord, '1. triggers en auth.users' as check_name,
       tgname || '  ::  ' || pg_get_triggerdef(t.oid) as result
from pg_trigger t
where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
union all
select 1, '1. triggers en auth.users', '(ninguno)'
where not exists (
  select 1 from pg_trigger t
  where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
)

-- 2. ¿Existe public.profiles? ¿Con qué columnas?
union all
select 2, '2. columnas de public.profiles',
       column_name || ' ' || data_type ||
       '  null=' || is_nullable ||
       '  default=' || coalesce(column_default, '-')
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
union all
select 2, '2. columnas de public.profiles', '(no existe public.profiles)'
where not exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'profiles'
)

-- 3. Funciones tipo handler de alta de usuario, con su cuerpo completo
union all
select 3, '3. funciones handle_new_user / *profile*',
       n.nspname || '.' || p.proname || E'\n' || pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'auth')
  and (p.proname ilike '%handle_new_user%'
       or p.proname ilike '%new_user%'
       or p.proname ilike '%profile%')
union all
select 3, '3. funciones handle_new_user / *profile*', '(ninguna)'
where not exists (
  select 1 from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'auth')
    and (p.proname ilike '%handle_new_user%'
         or p.proname ilike '%new_user%'
         or p.proname ilike '%profile%')
)

-- 4. boxes.owner_user_id: tipo + nullabilidad
union all
select 4, '4. boxes.owner_user_id (tipo)',
       column_name || ' ' || data_type || '  null=' || is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'boxes'
  and column_name = 'owner_user_id'
union all
select 4, '4. boxes.owner_user_id (tipo)', '(no existe boxes.owner_user_id)'
where not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'boxes'
    and column_name = 'owner_user_id'
)

-- 5. FKs de la tabla boxes
union all
select 5, '5. FKs de public.boxes',
       con.conname || '  ::  ' || pg_get_constraintdef(con.oid)
from pg_constraint con
where con.conrelid = 'public.boxes'::regclass and con.contype = 'f'
union all
select 5, '5. FKs de public.boxes', '(ninguna)'
where not exists (
  select 1 from pg_constraint con
  where con.conrelid = 'public.boxes'::regclass and con.contype = 'f'
)

-- 6. ¿Hay filas en boxes hoy? (confirmar que no hay nada real que preservar)
union all
select 6, '6. filas en public.boxes',
       'total=' || count(*) ||
       '  con owner=' || count(*) filter (where owner_user_id is not null)
from public.boxes

-- 7. RLS policies ya existentes sobre profiles
union all
select 7, '7. policies en public.profiles',
       policyname || '  [' || cmd || ']  using=' || coalesce(qual, '-') ||
       '  check=' || coalesce(with_check, '-')
from pg_policies
where schemaname = 'public' and tablename = 'profiles'
union all
select 7, '7. policies en public.profiles', '(ninguna)'
where not exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'profiles'
)

-- 8. Valores de rol que hay hoy en user_roles
union all
select 8, '8. roles en public.user_roles',
       role || ' = ' || count(*)
from public.user_roles
group by role

order by ord, result;
