-- Permisos para subir y borrar fotos (bucket «galeria»).
-- Ejecutar una vez en Supabase → SQL Editor (todo el archivo de una vez).
--
-- Antes solo podía subir fotos un perfil con rol exactamente 'PROFESIONAL', mientras que el resto
-- del panel (es_profesional) admite también 'ADMIN_PLATAFORMA'. Con ese rol, todo funcionaba menos
-- las fotos: Supabase respondía «new row violates row-level security policy».
-- Ahora vale cualquiera de los dos roles, y solo dentro de la carpeta de su negocio.

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

-- Comprobación: aquí debe salir el correo de Lynn con su rol y su negocio.
-- Si no sale ninguna fila, su cuenta no tiene perfil y por eso no puede subir fotos.
select u.email, p.role, p.business_id
  from public.profiles p join auth.users u on u.id = p.id;
