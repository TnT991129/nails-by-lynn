-- Avisos en el móvil de LYNN (Web Push) cuando una clienta reserva, cancela, cambia la fecha o los
-- servicios de su cita, se apunta a la lista de espera o deja una opinión.
-- Lynn los activa (y elige cuáles) en Panel → Más → «Avisos en este móvil».
-- Lo que hace la propia Lynn desde el panel no le genera aviso.
--
-- Ejecutar una vez en Supabase → SQL Editor (todo el archivo de una vez).
-- Sustituye a notificaciones_push.sql (avisos a las clientas), que se deshace aquí.
-- Necesita la Edge Function «enviar-push» (supabase/functions/enviar-push/index.ts).

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- =====================================================================
-- 0. Quitar la versión anterior (avisos a las clientas)
-- =====================================================================
drop trigger if exists tg_cita_push on public.appointments;
drop function if exists public.tg_cita_push();
drop function if exists public.encolar_recordatorios_push();
drop function if exists public.guardar_suscripcion_push(text, text, text, text);
drop function if exists public.quitar_suscripcion_push(text);
drop function if exists public.tomar_cola_push(int);
drop table if exists public.push_cola;
drop table if exists public.push_suscripciones;
do $$ begin perform cron.unschedule('nbl-push-recordatorios'); exception when others then null; end $$;

-- =====================================================================
-- 1. Móviles de Lynn con avisos activados (y qué avisos quiere en cada uno)
-- =====================================================================
create table public.push_suscripciones (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  eventos text[] not null default array['nueva', 'cancelada', 'reagendada', 'editada', 'espera', 'opinion'],
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index push_suscripciones_negocio_idx on public.push_suscripciones (business_id);
alter table public.push_suscripciones enable row level security;   -- sin políticas: solo funciones

-- Negocio de la profesional con la sesión abierta (null si no es profesional)
create or replace function public.mi_negocio_profesional()
returns uuid
language sql stable
security definer
set search_path = public
as $$
  select business_id from profiles
   where id = auth.uid() and role in ('PROFESIONAL', 'ADMIN_PLATAFORMA') limit 1
$$;
revoke all on function public.mi_negocio_profesional() from public, anon;
grant execute on function public.mi_negocio_profesional() to authenticated;

-- Activar o actualizar los avisos de este móvil
create or replace function public.guardar_aviso_movil(p_endpoint text, p_p256dh text, p_auth text, p_eventos text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_negocio uuid := mi_negocio_profesional();
begin
  if v_negocio is null then raise exception 'NO_AUTORIZADA'; end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 1000
     or length(coalesce(p_p256dh, '')) not between 20 and 200 or length(coalesce(p_auth, '')) not between 8 and 100 then
    raise exception 'SUSCRIPCION_INVALIDA';
  end if;

  insert into push_suscripciones (business_id, profile_id, endpoint, p256dh, auth, eventos)
  values (v_negocio, auth.uid(), p_endpoint, p_p256dh, p_auth, coalesce(p_eventos, '{}'))
  on conflict (endpoint) do update
    set business_id = excluded.business_id, profile_id = excluded.profile_id,
        p256dh = excluded.p256dh, auth = excluded.auth, eventos = excluded.eventos;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.guardar_aviso_movil(text, text, text, text[]) from public, anon;
grant execute on function public.guardar_aviso_movil(text, text, text, text[]) to authenticated;

-- Qué avisos tiene este móvil (null = ninguno)
create or replace function public.mis_avisos_movil(p_endpoint text)
returns text[]
language sql stable
security definer
set search_path = public
as $$
  select eventos from push_suscripciones where endpoint = p_endpoint and profile_id = auth.uid()
$$;
revoke all on function public.mis_avisos_movil(text) from public, anon;
grant execute on function public.mis_avisos_movil(text) to authenticated;

create or replace function public.quitar_aviso_movil(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$ delete from push_suscripciones where endpoint = p_endpoint and profile_id = auth.uid() $$;
revoke all on function public.quitar_aviso_movil(text) from public, anon;
grant execute on function public.quitar_aviso_movil(text) to authenticated;

-- =====================================================================
-- 2. Cola de avisos (la vacía la Edge Function)
-- =====================================================================
create table public.push_cola (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  evento text not null,       -- nueva | cancelada | reagendada | editada | espera | opinion
  ref_id uuid not null,       -- la cita, la fila de la lista de espera o la reseña
  created_at timestamptz not null default now(),
  tomado_at timestamptz,
  enviado_at timestamptz,
  resultado text
);
create index push_cola_pendientes_idx on public.push_cola (created_at) where enviado_at is null;
alter table public.push_cola enable row level security;   -- sin políticas: solo funciones

-- Llama a la Edge Function (la llamada sale al terminar la transacción)
create or replace function public.despertar_envio_push()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://wxkywplcbfrldnoajirn.supabase.co/functions/v1/super-handler',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 20000);
end $$;
revoke all on function public.despertar_envio_push() from public, anon, authenticated;

-- Deja un aviso en la cola si algún móvil de Lynn lo quiere (y no lo provocó ella misma)
create or replace function public.encolar_aviso(p_business_id uuid, p_evento text, p_ref uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if es_profesional(p_business_id) then return; end if;
  if not exists (select 1 from push_suscripciones where business_id = p_business_id and p_evento = any(eventos)) then return; end if;
  -- El mismo aviso repetido en menos de un minuto (p. ej. al editar) se manda una sola vez
  if exists (select 1 from push_cola where ref_id = p_ref and evento = p_evento and enviado_at is null
              and created_at > now() - interval '1 minute') then return; end if;
  insert into push_cola (business_id, evento, ref_id) values (p_business_id, p_evento, p_ref);
  perform despertar_envio_push();
end $$;
revoke all on function public.encolar_aviso(uuid, text, uuid) from public, anon, authenticated;

-- La Edge Function toma los pendientes (sin que dos envíos tomen el mismo)
create or replace function public.tomar_cola_push(p_limite int default 50)
returns setof public.push_cola
language sql
security definer
set search_path = public
as $$
  update push_cola set tomado_at = now()
   where id in (select id from push_cola
                where enviado_at is null and (tomado_at is null or tomado_at < now() - interval '5 minutes')
                  and created_at > now() - interval '2 days'
                order by created_at limit p_limite
                for update skip locked)
  returning *;
$$;
revoke all on function public.tomar_cola_push(int) from public, anon, authenticated;
grant execute on function public.tomar_cola_push(int) to service_role;

-- =====================================================================
-- 3. Qué genera aviso
-- =====================================================================
create or replace function public.tg_cita_aviso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_evento text;
begin
  if tg_op = 'INSERT' then
    v_evento := 'nueva';
  elsif new.status is distinct from old.status then
    if new.status = 'CANCELADA_CLIENTA' then v_evento := 'cancelada'; end if;
  elsif new.starts_at is distinct from old.starts_at then
    v_evento := 'reagendada';
  elsif new.total_amount is distinct from old.total_amount
     or new.total_duration_minutes is distinct from old.total_duration_minutes
     or new.client_note is distinct from old.client_note then
    v_evento := 'editada';
  end if;
  if v_evento is not null then perform encolar_aviso(new.business_id, v_evento, new.id); end if;
  return null;
end $$;
drop trigger if exists tg_cita_aviso on public.appointments;
create trigger tg_cita_aviso after insert or update on public.appointments
  for each row execute function public.tg_cita_aviso();

create or replace function public.tg_espera_aviso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform encolar_aviso(new.business_id, 'espera', new.id);
  return null;
end $$;
drop trigger if exists tg_espera_aviso on public.waitlist;
create trigger tg_espera_aviso after insert on public.waitlist
  for each row execute function public.tg_espera_aviso();

create or replace function public.tg_resena_aviso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform encolar_aviso(new.business_id, 'opinion', new.id);
  return null;
end $$;
drop trigger if exists tg_resena_aviso on public.reviews;
create trigger tg_resena_aviso after insert or update of rating, comment on public.reviews
  for each row execute function public.tg_resena_aviso();

-- =====================================================================
-- 4. Reintento cada 15 minutos de lo que no salió (sin conexión, función caída…)
-- =====================================================================
create or replace function public.reintentar_avisos_push()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from push_cola where enviado_at is null and created_at > now() - interval '2 days') then
    perform despertar_envio_push();
  end if;
end $$;
revoke all on function public.reintentar_avisos_push() from public, anon, authenticated;

select cron.schedule('nbl-avisos-reintento', '*/15 * * * *', 'select public.reintentar_avisos_push()');
