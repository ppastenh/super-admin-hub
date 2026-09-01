-- ============================================================================
-- SUPER-ADMIN-HUB — Guard anti-escalada en user_roles  (OPCIONAL)
--                   (proyecto WODPLACE / wiwpaekdykxernegicdv)
-- ----------------------------------------------------------------------------
-- El panel NO necesita esta migración para funcionar: hoy RLS está desactivado
-- en public.user_roles y public.boxes, y `authenticated` tiene todos los grants,
-- así que un super_admin logueado ya puede operar el panel.
--
-- El problema que resuelve: con RLS off + grants, HOY cualquier cuenta de Auth
-- puede `insert into user_roles (user_id, role) values (<su id>, 'super_admin')`
-- y auto-promoverse. Esta migración agrega un trigger BEFORE en user_roles que
-- solo deja modificar la tabla si:
--   - la llamada viene sin sesión de usuario (service_role / SQL Editor / backend
--     -> auth.uid() IS NULL), o
--   - el que llama ya es super_admin.
--
-- NO activa RLS y NO toca los SELECT: crossfit-dash-pro y demás consumidores que
-- leen user_roles como `authenticated` siguen funcionando igual.
--
-- Aditivo e idempotente. Correr en el SQL Editor de WODPLACE si se quiere.
-- (El primer super_admin ya existe, así que no hay problema de bootstrap: los
--  próximos los crea un super_admin existente o el service_role.)
-- ============================================================================

begin;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin'
  );
$$;

revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated, service_role;

create or replace function public.guard_user_roles_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- sin sesión de usuario (service_role, SQL Editor, backend) -> permitido
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  -- un super_admin puede administrar roles (incluye el flujo del panel)
  if public.is_super_admin() then
    return coalesce(new, old);
  end if;
  raise exception 'Solo un super_admin puede modificar user_roles'
    using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function public.guard_user_roles_writes() from public, anon, authenticated;

drop trigger if exists guard_user_roles_writes on public.user_roles;
create trigger guard_user_roles_writes
  before insert or update or delete on public.user_roles
  for each row execute function public.guard_user_roles_writes();

commit;
