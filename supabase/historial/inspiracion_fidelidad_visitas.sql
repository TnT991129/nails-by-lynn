-- Tres funciones nuevas para la web. Solo AÑADE cosas: no cambia citas, clientas, servicios, precios,
-- horarios ni ninguna función que ya exista. Ejecutar una vez en Supabase → SQL Editor (todo el archivo);
-- va entre begin/commit: si algo falla, no se aplica nada.
--
-- 1. Foto de inspiración: la clienta adjunta hasta 3 fotos a su cita. Se guardan en un almacén PRIVADO
--    («referencias»): solo Lynn las ve desde el panel.
-- 2. Tarjeta de fidelidad: la clienta ve sus sellos (citas completadas) y, al completar la que toca,
--    recibe sola el descuento que Lynn configuró (Panel → Más → Tarjeta de fidelidad).
-- 3. Visitas y reservas: eventos anónimos (sin IP ni datos personales) para ver en Estadísticas
--    cuántas personas entran, empiezan a reservar y terminan. Se borran solos a los 180 días.

begin;

-- =====================================================================
-- 1. FOTO DE INSPIRACIÓN
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('referencias', 'referencias', false, 3145728, '{image/jpeg,image/png,image/webp}')
on conflict (id) do nothing;

drop policy if exists "Clientas suben inspiracion" on storage.objects;
drop policy if exists "PROFESIONAL ve inspiracion" on storage.objects;
drop policy if exists "PROFESIONAL borra inspiracion" on storage.objects;

-- Fotos subidas en la última hora (cuenta con permisos del sistema: la clienta no puede ver las fotos)
create or replace function public.subidas_inspiracion_ultima_hora()
returns integer
language sql
stable
security definer
set search_path = public, storage
as $$
  select count(*)::int from storage.objects where bucket_id = 'referencias' and created_at > now() - interval '1 hour'
$$;
revoke all on function public.subidas_inspiracion_ultima_hora() from public;
grant execute on function public.subidas_inspiracion_ultima_hora() to anon, authenticated;

-- Cualquiera puede subir a la carpeta del negocio (la web no tiene cuentas), con un tope global por hora
create policy "Clientas suben inspiracion" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'referencias'
    and (storage.foldername(name))[1] = '1a115b41-0000-4000-8000-000000000001'
    and public.subidas_inspiracion_ultima_hora() < 60);

create policy "PROFESIONAL ve inspiracion" on storage.objects
  for select to authenticated
  using (bucket_id = 'referencias' and exists (select 1 from public.profiles p
           where p.id = auth.uid() and p.role in ('PROFESIONAL', 'ADMIN_PLATAFORMA')
             and p.business_id::text = (storage.foldername(name))[1]));

create policy "PROFESIONAL borra inspiracion" on storage.objects
  for delete to authenticated
  using (bucket_id = 'referencias' and exists (select 1 from public.profiles p
           where p.id = auth.uid() and p.role in ('PROFESIONAL', 'ADMIN_PLATAFORMA')
             and p.business_id::text = (storage.foldername(name))[1]));

create table if not exists public.appointment_references (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now(),
  unique (appointment_id, path)
);
create index if not exists appointment_references_cita_idx on public.appointment_references (appointment_id);
alter table public.appointment_references enable row level security;
revoke all on table public.appointment_references from anon;

drop policy if exists prof_referencias on public.appointment_references;
create policy prof_referencias on public.appointment_references for all to authenticated
  using (exists (select 1 from appointments a where a.id = appointment_id and es_profesional(a.business_id)));

-- La clienta une la foto ya subida a su cita (con el token de la cita, como el resto de la web)
create or replace function public.adjuntar_referencia(p_token text, p_path text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a appointments%rowtype;
begin
  select * into a from appointments where access_token = p_token;
  if not found then raise exception 'CITA_NO_ENCONTRADA'; end if;
  if a.status not in ('PENDIENTE', 'CONFIRMADA') then raise exception 'CITA_NO_EDITABLE'; end if;
  if p_path is null or p_path not like a.business_id::text || '/%' or length(p_path) > 200 then raise exception 'FOTO_INVALIDA'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'referencias' and name = p_path) then raise exception 'FOTO_INVALIDA'; end if;
  if (select count(*) from appointment_references where appointment_id = a.id) >= 3 then raise exception 'LIMITE_FOTOS'; end if;
  insert into appointment_references (appointment_id, path) values (a.id, p_path) on conflict do nothing;
  return jsonb_build_object('ok', true,
    'total', (select count(*) from appointment_references where appointment_id = a.id));
end $$;
revoke all on function public.adjuntar_referencia(text, text) from public;
grant execute on function public.adjuntar_referencia(text, text) to anon, authenticated;

create or replace function public.contar_referencias(p_token text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from appointment_references r join appointments a on a.id = r.appointment_id
   where a.access_token = p_token
$$;
revoke all on function public.contar_referencias(text) from public;
grant execute on function public.contar_referencias(text) to anon, authenticated;

-- =====================================================================
-- 2. TARJETA DE FIDELIDAD
-- =====================================================================
-- Sellos de la clienta de una cita (citas completadas; las cuenta ya el trigger t_contadores)
create or replace function public.tarjeta_fidelidad(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('completadas', c.total_appointments,
                            'descuento_pendiente', c.next_discount_percent)
    from appointments a join clients c on c.id = a.client_id
   where a.access_token = p_token
$$;
revoke all on function public.tarjeta_fidelidad(text) from public;
grant execute on function public.tarjeta_fidelidad(text) to anon, authenticated;

-- Al completar la cita que toca, se le deja el premio para la próxima.
-- La configuración la guarda Lynn en settings.site_texts → «_fidelidad» (JSON: activa, sellos, premio).
-- Cualquier fallo aquí se ignora: completar una cita nunca puede fallar por la tarjeta.
create or replace function public.tg_premio_fidelidad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare cfg jsonb; v_sellos int; v_premio numeric; v_hechas int;
begin
  if new.status <> 'COMPLETADA' or old.status = 'COMPLETADA' then return null; end if;
  begin
    select (site_texts ->> '_fidelidad')::jsonb into cfg from settings where business_id = new.business_id;
    if cfg is null or coalesce((cfg ->> 'activa')::boolean, false) is false then return null; end if;
    v_sellos := (cfg ->> 'sellos')::int;
    v_premio := (cfg ->> 'premio')::numeric;
    if v_sellos is null or v_sellos < 2 or v_premio is null or v_premio <= 0 or v_premio > 100 then return null; end if;
    select total_appointments into v_hechas from clients where id = new.client_id;
    if v_hechas > 0 and v_hechas % v_sellos = 0 then
      update clients
         set next_discount_percent = greatest(coalesce(next_discount_percent, 0), v_premio),
             next_discount_note = 'Premio de la tarjeta de fidelidad', next_discount_at = now()
       where id = new.client_id;
    end if;
  exception when others then
    raise warning 'tg_premio_fidelidad: %', sqlerrm;
  end;
  return null;
end $$;
revoke all on function public.tg_premio_fidelidad() from public, anon, authenticated;
-- El nombre empieza por «tg_p…»: va después de t_contadores (que suma la cita) en el orden alfabético
drop trigger if exists tg_premio_fidelidad on public.appointments;
create trigger tg_premio_fidelidad after update of status on public.appointments
  for each row execute function public.tg_premio_fidelidad();

-- =====================================================================
-- 3. VISITAS Y RESERVAS
-- =====================================================================
create table if not exists public.visitas_web (
  id bigint generated always as identity primary key,
  creado timestamptz not null default now(),
  evento text not null,
  sesion text not null           -- número al azar de la visita (no identifica a nadie)
);
create index if not exists visitas_web_creado_idx on public.visitas_web (creado);
alter table public.visitas_web enable row level security;   -- sin políticas: solo funciones
revoke all on table public.visitas_web from anon, authenticated;

create or replace function public.registrar_evento(p_evento text, p_sesion text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_evento not in ('visita', 'reserva_inicio', 'reserva_fecha', 'reserva_hora', 'reserva_datos', 'reserva_resumen',
                      'reserva_hecha', 'whatsapp') then return; end if;
  if p_sesion is null or length(p_sesion) not between 8 and 40 then return; end if;
  -- Cada visita cuenta una vez por evento
  if exists (select 1 from visitas_web where sesion = p_sesion and evento = p_evento
              and creado > now() - interval '1 day') then return; end if;
  insert into visitas_web (evento, sesion) values (p_evento, p_sesion);
  if random() < 0.01 then delete from visitas_web where creado < now() - interval '180 days'; end if;
end $$;
revoke all on function public.registrar_evento(text, text) from public;
grant execute on function public.registrar_evento(text, text) to anon, authenticated;

-- Para Estadísticas (solo Lynn): visitas distintas de cada evento en los últimos p_dias, y visitas por día
create or replace function public.embudo_web(p_dias int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not es_profesional('1a115b41-0000-4000-8000-000000000001') then raise exception 'NO_AUTORIZADA'; end if;
  return jsonb_build_object(
    'eventos', coalesce((select jsonb_object_agg(evento, n) from (
                 select evento, count(distinct sesion) n from visitas_web
                  where creado > now() - make_interval(days => least(greatest(p_dias, 1), 180))
                  group by evento) e), '{}'::jsonb),
    'por_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'visitas', n) order by dia) from (
                 select (creado at time zone 'America/Havana')::date dia, count(distinct sesion) n from visitas_web
                  where evento = 'visita' and creado > now() - make_interval(days => least(greatest(p_dias, 1), 180))
                  group by 1) d), '[]'::jsonb));
end $$;
revoke all on function public.embudo_web(int) from public, anon;
grant execute on function public.embudo_web(int) to authenticated;

commit;

-- Comprobación: debe salir referencias = true, tabla_fotos = true, tabla_visitas = true, trigger = true
select exists (select 1 from storage.buckets where id = 'referencias') as referencias,
       to_regclass('public.appointment_references') is not null as tabla_fotos,
       to_regclass('public.visitas_web') is not null as tabla_visitas,
       exists (select 1 from pg_trigger where tgname = 'tg_premio_fidelidad') as trigger;
