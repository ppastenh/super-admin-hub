-- ============================================================================
-- DIAGNÓSTICO #2 — RLS/grants de boxes y user_roles (WODPLACE)
-- Correr en el SQL Editor. Solo lee catálogos. Un resultado combinado.
--
-- Sirve para saber si un super_admin puede, DESDE EL CLIENTE:
--   - UPDATE public.boxes (aprobar / rechazar)
--   - INSERT public.user_roles (crear el box_admin)
--
-- RESULTADO YA OBTENIDO (2026-08-31): RLS OFF en ambas + grants completos a
-- `authenticated` -> el panel funciona sin migración extra. El único riesgo es
-- escalada de privilegios en user_roles; para cerrarlo (opcional) está
-- 20260831193000_user_roles_escalation_guard.sql.
-- ============================================================================

select 1 as ord, 'RLS activo' as check_name,
       relname || '  rowsecurity=' || relrowsecurity || '  forced=' || relforcerowsecurity as result
from pg_class
where relname in ('boxes', 'user_roles') and relnamespace = 'public'::regnamespace

union all
select 2, 'policies en boxes',
       policyname || '  [' || cmd || '  roles=' || array_to_string(roles, ',') || ']' ||
       '  using=' || coalesce(qual, '-') ||
       '  check=' || coalesce(with_check, '-')
from pg_policies where schemaname = 'public' and tablename = 'boxes'
union all
select 2, 'policies en boxes', '(ninguna)'
where not exists (select 1 from pg_policies where schemaname='public' and tablename='boxes')

union all
select 3, 'policies en user_roles',
       policyname || '  [' || cmd || '  roles=' || array_to_string(roles, ',') || ']' ||
       '  using=' || coalesce(qual, '-') ||
       '  check=' || coalesce(with_check, '-')
from pg_policies where schemaname = 'public' and tablename = 'user_roles'
union all
select 3, 'policies en user_roles', '(ninguna)'
where not exists (select 1 from pg_policies where schemaname='public' and tablename='user_roles')

union all
select 4, 'grants a authenticated',
       table_name || ': ' || string_agg(privilege_type, ', ' order by privilege_type)
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('boxes', 'user_roles')
  and grantee = 'authenticated'
group by table_name

union all
select 5, 'funciones helper de rol existentes',
       n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname ilike '%super_admin%' or p.proname ilike '%has_role%'
       or p.proname ilike '%is_admin%' or p.proname ilike '%user_is_box_staff%')
union all
select 5, 'funciones helper de rol existentes', '(ninguna)'
where not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (p.proname ilike '%super_admin%' or p.proname ilike '%has_role%'
         or p.proname ilike '%is_admin%' or p.proname ilike '%user_is_box_staff%')
)

order by ord, result;
