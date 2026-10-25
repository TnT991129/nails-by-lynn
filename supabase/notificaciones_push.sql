-- Notificaciones en el móvil de la clienta (Web Push) por cada reserva, confirmación, cambio,
-- cancelación, recordatorio del día anterior y agradecimiento.
-- Ejecutar una vez en Supabase → SQL Editor (todo el archivo de una vez), después de textos_web.sql.
-- Necesita además la Edge Function «enviar-push» (supabase/functions/enviar-push/index.ts).
--
-- Cómo funciona:
--   1. La clienta toca «Activar avisos» en su cita: su móvil queda guardado en push_suscripciones.
--   2. Cada cambio en una cita deja un aviso en push_cola (disparador tg_cita_push).
--   3. Se llama a la Edge Function, que envía lo pendiente de la cola y lo marca como enviado.
--      La función solo vacía la cola: aunque alguien la llame, no puede inventar avisos.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- =====================================================================
-- 1. Móviles de cada clienta que aceptaron recibir avisos
-- =====================================================================
create table if not exists public.push_suscripciones (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index if not exists push_suscripciones_client_idx on public.push_suscripciones (client_id);
alter table public.push_suscripciones enable row level security;   -- sin políticas: solo funciones

-- La clienta activa los avisos desde el enlace de su cita (el token demuestra que es ella)
create or replace function public.guardar_suscripcion_push(p_token text, p_endpoint text, p_p256dh text, p_auth text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a appointments%rowtype; v_total int;
begin
  select * into a from appointments where access_token = p_token;
  if not found then raise exception 'CITA_NO_ENCONTRADA'; end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 1000
     or length(coalesce(p_p256dh, '')) not between 20 and 200 or length(coalesce(p_auth, '')) not between 8 and 100 then
    raise exception 'SUSCRIPCION_INVALIDA';
  end if;

  insert into push_suscripciones (business_id, client_id, endpoint, p256dh, auth)
  values (a.business_id, a.client_id, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set client_id = excluded.client_id, business_id = excluded.business_id,
        p256dh = excluded.p256dh, auth = excluded.auth;

  -- Como mucho 10 móviles por clienta: se quitan los más antiguos
  delete from push_suscripciones where id in (
    select id from push_suscripciones where client_id = a.client_id
    order by created_at desc offset 10);

  select count(*) into v_total from push_suscripciones where client_id = a.client_id;
  return jsonb_build_object('ok', true, 'moviles', v_total);
end $$;
revoke all on function public.guardar_suscripcion_push(text, text, text, text) from public;
grant execute on function public.guardar_suscripcion_push(text, text, text, text) to anon, authenticated;

-- La clienta desactiva los avisos en este móvil
create or replace function public.quitar_suscripcion_push(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$ delete from push_suscripciones where endpoint = p_endpoint $$;
revoke all on function public.quitar_suscripcion_push(text) from public;
grant execute on function public.quitar_suscripcion_push(text) to anon, authenticated;

-- =====================================================================
-- 2. Cola de avisos
-- =====================================================================
create table if not exists public.push_cola (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  evento text not null,
  created_at timestamptz not null default now(),
  tomado_at timestamptz,
  enviado_at timestamptz,
  resultado text
);
create index if not exists push_cola_pendientes_idx on public.push_cola (created_at) where enviado_at is null;
create index if not exists push_cola_cita_idx on public.push_cola (appointment_id, evento);
alter table public.push_cola enable row level security;   -- sin políticas: solo funciones

-- Avisa a la Edge Function de que hay algo en la cola (la llamada sale al terminar la transacción)
create or replace function public.despertar_envio_push()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://wxkywplcbfrldnoajirn.supabase.co/functions/v1/enviar-push',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 20000);
end $$;
revoke all on function public.despertar_envio_push() from public, anon, authenticated;

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
-- 3. Qué cambios de una cita generan aviso
-- =====================================================================
create or replace function public.tg_cita_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_evento text;
begin
  if tg_op = 'INSERT' then
    v_evento := 'creada';
  elsif new.status is distinct from old.status then
    v_evento := case new.status
      when 'CONFIRMADA'        then case when old.status = 'PENDIENTE' then 'confirmada' end
      when 'CANCELADA_NEGOCIO' then 'cancelada_negocio'
      when 'CANCELADA_CLIENTA' then 'cancelada_clienta'
      when 'COMPLETADA'        then 'completada'
    end;
  elsif new.starts_at is distinct from old.starts_at and new.status in ('PENDIENTE', 'CONFIRMADA') then
    v_evento := 'reagendada';
  elsif (new.total_amount is distinct from old.total_amount
         or new.total_duration_minutes is distinct from old.total_duration_minutes)
        and new.status in ('PENDIENTE', 'CONFIRMADA', 'EN_CURSO') then
    v_evento := 'actualizada';
  end if;

  -- Solo si la clienta tiene algún móvil con avisos activados
  if v_evento is not null and exists (select 1 from push_suscripciones where client_id = new.client_id) then
    -- Un mismo aviso repetido en menos de un minuto (p. ej. al editar) se manda una sola vez
    if not exists (select 1 from push_cola where appointment_id = new.id and evento = v_evento
                    and enviado_at is null and created_at > now() - interval '1 minute') then
      insert into push_cola (appointment_id, evento) values (new.id, v_evento);
      perform despertar_envio_push();
    end if;
  end if;
  return null;
end $$;

drop trigger if exists tg_cita_push on public.appointments;
create trigger tg_cita_push after insert or update on public.appointments
  for each row execute function public.tg_cita_push();

-- =====================================================================
-- 4. Recordatorio del día anterior (cada 15 minutos, citas que empiezan en unas 24 h)
-- =====================================================================
create or replace function public.encolar_recordatorios_push()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  insert into push_cola (appointment_id, evento)
  select a.id, 'recordatorio' from appointments a
   where a.status in ('PENDIENTE', 'CONFIRMADA')
     and a.starts_at between now() + interval '22 hours' and now() + interval '25 hours'
     and exists (select 1 from push_suscripciones s where s.client_id = a.client_id)
     and not exists (select 1 from push_cola c where c.appointment_id = a.id and c.evento = 'recordatorio');
  get diagnostics v_n = row_count;
  -- También reintenta lo que se quedó sin enviar (sin conexión, función caída…)
  if v_n > 0 or exists (select 1 from push_cola where enviado_at is null and created_at > now() - interval '2 days') then
    perform despertar_envio_push();
  end if;
end $$;
revoke all on function public.encolar_recordatorios_push() from public, anon, authenticated;

select cron.schedule('nbl-push-recordatorios', '*/15 * * * *', 'select public.encolar_recordatorios_push()');
