-- =====================================================================================
--  Notificaciones de Trabajo — esquema Supabase (pegar COMPLETO en Dashboard → SQL Editor → Run)
--
--  Crea:
--    · public.profiles : 1 fila por usuario de auth.users (nombre, rol, aprobado). La crea un trigger
--                        al registrarse, en estado PENDIENTE (approved=false, role='tecnico').
--    · public.reportes : reportes guardados por usuario (calibraciones y notificaciones .txt), payload jsonb.
--    · RLS: cada usuario solo lee/escribe lo suyo; solo los APROBADOS pueden guardar; los ADMIN
--           (role='admin' y aprobados) leen todo y aprueban/revocan/cambian rol.
--
--  Este archivo NO contiene secretos. La "anon key" del proyecto es pública por diseño (la protege RLS).
--  NUNCA pongas la "service_role" key en la app ni en el repositorio.
--
--  Bootstrap del PRIMER administrador (después de registrarte desde la app con tu correo):
--    update public.profiles set role='admin', approved=true where email='TU_CORREO@dominio.com';
--    select id, email, full_name, role, approved from public.profiles;   -- comprobar
--  (auth.uid() es NULL desde el SQL Editor, por eso el guard de abajo deja pasar este update.)
--
--  Ajustes de Authentication en el dashboard:
--    · Providers → Email: Enable ON; "Confirm email" OFF (la aprobación del admin es el filtro).
--    · Sign In / Providers → "Allow new users to sign up" ON.
--    · URL Configuration → Site URL = https://luisrico5.github.io/notificaciones-trabajo/
--    · Project Settings → API: copiar Project URL y anon public key → SB_URL / SB_ANON_KEY en src/part_tail.html
-- =====================================================================================

-- ===== Perfiles (1 por usuario de auth.users) =====
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  role        text not null default 'tecnico' check (role in ('tecnico','admin')),
  approved    boolean not null default false,
  created_at  timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null
);
alter table public.profiles enable row level security;

-- Helpers SECURITY DEFINER: evitan la recursión de RLS (una política de profiles que consulta profiles).
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.approved);
$$;
create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.approved);
$$;
revoke all on function public.is_admin(), public.is_approved() from public;
grant execute on function public.is_admin(), public.is_approved() to authenticated;

-- Trigger: crea el perfil al registrarse (pendiente, rol tecnico). full_name viene de options.data del signup.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email,''),
          coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''), split_part(coalesce(new.email,''),'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Guard: solo un admin cambia role/approved (defensa extra a RLS); sella approved_at/by; id/email/created_at inmutables.
-- auth.uid() es NULL desde el SQL Editor → el bootstrap del primer admin pasa.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and (new.role is distinct from old.role or new.approved is distinct from old.approved)
     and not public.is_admin() then
    raise exception 'Solo un administrador puede aprobar o cambiar el rol';
  end if;
  if new.approved and not old.approved then new.approved_at := now(); new.approved_by := auth.uid(); end if;
  if not new.approved then new.approved_at := null; new.approved_by := null; end if;
  new.id := old.id; new.email := old.email; new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- Políticas profiles
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- (sin insert/delete por API: inserta el trigger; borrar = eliminar el usuario en Authentication → Users, cascada)

-- ===== Reportes guardados por usuario =====
create table if not exists public.reportes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('calibracion','notificacion')),
  tag        text not null default '',
  ot         text not null default '',
  titulo     text not null default '',
  payload    jsonb not null,
  schema_v   int  not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reportes_payload_size check (pg_column_size(payload) < 2000000),   -- < 2 MB por reporte
  constraint reportes_unico unique (user_id, kind, tag, ot)                      -- clave del upsert
);
create index if not exists reportes_user_updated_idx on public.reportes (user_id, updated_at desc);
create index if not exists reportes_kind_updated_idx on public.reportes (kind, updated_at desc);
alter table public.reportes enable row level security;

create or replace function public.reportes_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now(); new.user_id := old.user_id; new.created_at := old.created_at; new.kind := old.kind;
  return new;
end $$;
drop trigger if exists reportes_touch on public.reportes;
create trigger reportes_touch before update on public.reportes for each row execute function public.reportes_touch();

drop policy if exists "reportes_select_own_or_admin" on public.reportes;
create policy "reportes_select_own_or_admin" on public.reportes for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "reportes_insert_own_approved" on public.reportes;
create policy "reportes_insert_own_approved" on public.reportes for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved());
drop policy if exists "reportes_update_own_approved" on public.reportes;
create policy "reportes_update_own_approved" on public.reportes for update to authenticated
  using (user_id = auth.uid() and public.is_approved())
  with check (user_id = auth.uid() and public.is_approved());
drop policy if exists "reportes_delete_own_or_admin" on public.reportes;
create policy "reportes_delete_own_or_admin" on public.reportes for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Endurecer: el rol anon (sin login) no ve nada; authenticated solo lo que RLS permite.
revoke all on public.profiles, public.reportes from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.reportes to authenticated;

-- =====================================================================================================
-- RESPALDO EN LA NUBE DE LA BASE DPCTrack ORIGINAL (botón "Grabar a la base de datos", Opción 1)
-- Antes de entregar la base actualizada, la página sube la base ORIGINAL comprimida (gzip) a un bucket
-- PRIVADO. Existe SIEMPRE UN SOLO respaldo: ruta fija 'base_original.mdb.gz' (cada grabado lo reemplaza) y
-- una tabla de UNA sola fila con sus datos. Solo usuarios APROBADOS pueden subirlo o descargarlo.
-- Se puede volver a ejecutar sin problema.
-- =====================================================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('respaldo-base', 'respaldo-base', false, 52428800, array['application/gzip'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "respaldo_base_select" on storage.objects;
create policy "respaldo_base_select" on storage.objects for select to authenticated
  using (bucket_id = 'respaldo-base' and public.is_approved());
drop policy if exists "respaldo_base_insert" on storage.objects;
create policy "respaldo_base_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'respaldo-base' and public.is_approved());
drop policy if exists "respaldo_base_update" on storage.objects;
create policy "respaldo_base_update" on storage.objects for update to authenticated
  using (bucket_id = 'respaldo-base' and public.is_approved())
  with check (bucket_id = 'respaldo-base' and public.is_approved());
drop policy if exists "respaldo_base_delete" on storage.objects;
create policy "respaldo_base_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'respaldo-base' and public.is_approved());

create table if not exists public.respaldo_base (
  id                smallint primary key default 1 check (id = 1),     -- una sola fila
  nombre            text   not null,                                    -- nombre del archivo .mdb original
  bytes             bigint not null,                                    -- tamaño sin comprimir
  bytes_gz          bigint not null,                                    -- tamaño comprimido en la nube
  sha256            text   not null,                                    -- huella del .mdb original (verifica la descarga)
  instrumentos      jsonb  not null default '[]'::jsonb,                -- TAGs del grabado que motivó el respaldo
  subido_por        uuid references public.profiles(id) on delete set null,
  subido_por_nombre text   not null default '',
  subido_at         timestamptz not null default now()
);
alter table public.respaldo_base enable row level security;

-- Quién y cuándo lo fija el servidor (no se confía en el cliente).
create or replace function public.respaldo_base_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.id := 1;
  new.subido_por := auth.uid();
  new.subido_por_nombre := coalesce((select p.full_name from public.profiles p where p.id = auth.uid()), '');
  new.subido_at := now();
  return new;
end $$;
drop trigger if exists respaldo_base_stamp on public.respaldo_base;
create trigger respaldo_base_stamp before insert or update on public.respaldo_base
  for each row execute function public.respaldo_base_stamp();

drop policy if exists "respaldo_base_row_select" on public.respaldo_base;
create policy "respaldo_base_row_select" on public.respaldo_base for select to authenticated
  using (public.is_approved());
drop policy if exists "respaldo_base_row_insert" on public.respaldo_base;
create policy "respaldo_base_row_insert" on public.respaldo_base for insert to authenticated
  with check (public.is_approved());
drop policy if exists "respaldo_base_row_update" on public.respaldo_base;
create policy "respaldo_base_row_update" on public.respaldo_base for update to authenticated
  using (public.is_approved()) with check (public.is_approved());

revoke all on public.respaldo_base from anon;
grant select, insert, update on public.respaldo_base to authenticated;
