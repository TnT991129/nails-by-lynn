-- Fotos: permisos de subida (otra vez, por si fotos_permisos.sql no se ejecutó), registro de errores
-- de subida y una consulta de diagnóstico.
-- Ejecutar una vez en Supabase → SQL Editor (todo el archivo de una vez).

-- =====================================================================
-- 1. Permisos del bucket «galeria»: profesional del negocio, dentro de la carpeta de su negocio
-- =====================================================================
drop policy if exists "PROFESIONAL sube fotos" on storage.objects;
drop policy if exists "PROFESIONAL borra fotos" on storage.objects;
drop policy if exists "PROFESIONAL cambia fotos" on storage.objects;

create policy "PROFESIONAL sube fotos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'galeria'
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role in ('PROFESIONAL', 'ADMIN_PLATAFORMA')
                  and p.business_id::text = (storage.foldername(name))[1]));

create policy "PROFESIONAL borra fotos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'galeria'
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role in ('PROFESIONAL', 'ADMIN_PLATAFORMA')
                  and p.business_id::text = (storage.foldername(name))[1]));

create policy "PROFESIONAL cambia fotos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'galeria'
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role in ('PROFESIONAL', 'ADMIN_PLATAFORMA')
                  and p.business_id::text = (storage.foldername(name))[1]));

-- =====================================================================
-- 2. Registro de errores del panel (solo datos técnicos: paso, tipo y tamaño del archivo, navegador)
-- =====================================================================
create table if not exists public.registro_errores (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  origen text not null,
  mensaje text,
  detalle jsonb
);
alter table public.registro_errores enable row level security;   -- sin políticas: solo funciones

create or replace function public.registrar_error_panel(p_origen text, p_mensaje text, p_detalle jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into registro_errores (origen, mensaje, detalle)
  values (left(coalesce(p_origen, ''), 50), left(p_mensaje, 500),
          coalesce(p_detalle, '{}'::jsonb) || jsonb_build_object(
            -- Con qué rol estaba la sesión (para saber si el permiso de subida podía fallar)
            'rol', (select role from profiles where id = auth.uid()),
            'negocio_ok', (select business_id::text = '1a115b41-0000-4000-8000-000000000001' from profiles where id = auth.uid())));
  delete from registro_errores where created_at < now() - interval '30 days';
end $$;
revoke all on function public.registrar_error_panel(text, text, jsonb) from public, anon;
grant execute on function public.registrar_error_panel(text, text, jsonb) to authenticated;

-- =====================================================================
-- 3. Diagnóstico de las fotos: configuración del bucket, permisos y últimos errores
--    (sin datos personales; se puede quitar cuando las fotos funcionen: drop function public.diagnostico_fotos)
-- =====================================================================
create or replace function public.diagnostico_fotos()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'bucket', (select jsonb_build_object('publico', public, 'limite_bytes', file_size_limit, 'tipos', allowed_mime_types)
                 from storage.buckets where id = 'galeria'),
    'permisos', (select jsonb_agg(jsonb_build_object('nombre', policyname, 'accion', cmd, 'roles', roles))
                   from pg_policies where schemaname = 'storage' and tablename = 'objects'),
    'perfiles', (select jsonb_agg(jsonb_build_object('rol', role,
                    'negocio_ok', business_id::text = '1a115b41-0000-4000-8000-000000000001')) from profiles),
    'errores', (select jsonb_agg(jsonb_build_object('cuando', created_at, 'origen', origen, 'mensaje', mensaje,
                    'detalle', detalle) order by created_at desc)
                  from (select * from registro_errores order by created_at desc limit 20) e));
$$;
revoke all on function public.diagnostico_fotos() from public;
grant execute on function public.diagnostico_fotos() to anon, authenticated;
