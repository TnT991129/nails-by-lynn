-- Textos de la web de las clientas editables por Lynn (Panel → Más → Textos de la web).
-- Ejecutar una vez en Supabase → SQL Editor, después de panel_editar_y_politicas.sql.
-- Solo se guardan los textos que Lynn cambia: { "inicio.titulo": "…", … }. Lo demás usa el texto de la app.

alter table settings add column if not exists site_texts jsonb not null default '{}'::jsonb;
alter table settings drop constraint if exists settings_textos_objeto;
alter table settings add constraint settings_textos_objeto check (jsonb_typeof(site_texts) = 'object');

-- Lectura pública (settings es privada: solo sale este campo)
create or replace function public.obtener_textos(p_business_id uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select coalesce((select site_texts from settings where business_id = p_business_id), '{}'::jsonb)
$$;

revoke all on function public.obtener_textos(uuid) from public;
grant execute on function public.obtener_textos(uuid) to anon, authenticated;
