-- Turnos fijos: las clientas solo pueden reservar a las 9:00 AM o 1:00 PM (hora de La Habana).
-- Ejecutar una vez en Supabase → SQL Editor.
-- Para volver al modo anterior (huecos cada N minutos): update settings set fixed_slot_times = null;

-- 1. Horas de inicio permitidas. NULL = modo libre (cada slot_granularity_minutes).
alter table settings add column if not exists fixed_slot_times time[];

update settings set fixed_slot_times = array['09:00','13:00']::time[]
 where business_id = '1a115b41-0000-4000-8000-000000000001';

-- 2. ¿Esta hora de inicio es uno de los turnos del negocio?
create or replace function public.es_turno_valido(p_business_id uuid, p_inicio timestamptz)
 returns boolean
 language sql stable
 security definer
 set search_path to 'public', 'extensions'
as $$
  select coalesce((
    select s.fixed_slot_times is null
        or (p_inicio at time zone b.timezone)::time = any (s.fixed_slot_times)
      from settings s join businesses b on b.id = s.business_id
     where s.business_id = p_business_id
  ), true)
$$;

-- 3. Guardia en el servidor. Lynn (sesión autenticada) queda libre para excepciones.
create or replace function public.validar_turno()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $$
begin
  if tg_op = 'UPDATE' and new.starts_at = old.starts_at then return new; end if;
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'anon')
       <> 'authenticated'
     and not es_turno_valido(new.business_id, new.starts_at) then
    raise exception 'HORARIO_NO_DISPONIBLE';
  end if;
  return new;
end $$;

drop trigger if exists tg_holds_turno on holds;
create trigger tg_holds_turno before insert on holds
  for each row execute function validar_turno();

drop trigger if exists tg_appointments_turno on appointments;
create trigger tg_appointments_turno before insert or update of starts_at on appointments
  for each row execute function validar_turno();

-- 4. Disponibilidad: en modo turnos solo devuelve las horas fijas
create or replace function public.obtener_disponibilidad(p_business_id uuid, p_fecha date, p_duracion_minutos integer, p_buffer_minutos integer default null::integer)
 returns table(hora timestamp with time zone)
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare s settings%rowtype; v_buffer int; v_acepta boolean; v_tz text; v_min timestamptz; v_max date;
begin
  delete from holds where business_id = p_business_id and expires_at < now();

  select * into s from settings where business_id = p_business_id;
  if not found then return; end if;
  select is_accepting_bookings, timezone into v_acepta, v_tz from businesses where id = p_business_id;
  if not v_acepta then return; end if;

  v_buffer := coalesce(p_buffer_minutos, s.default_buffer_minutes);
  v_min := now() + make_interval(hours => s.min_advance_hours);
  v_max := (now() + make_interval(days => s.max_advance_days))::date;
  if p_fecha > v_max then return; end if;

  return query
  with candidatos as (
    -- Modo libre: un hueco cada N minutos y la cita debe caber antes del cierre
    select generate_series(t.ini, t.fin - make_interval(mins => p_duracion_minutos),
                           make_interval(mins => s.slot_granularity_minutes)) as h,
           t.fin
    from intervalos_trabajo(p_business_id, p_fecha) t
    where s.fixed_slot_times is null
    union all
    -- Turnos fijos: se ofrece el turno si su hora de inicio cae dentro del horario del día
    select (p_fecha + x.turno) at time zone v_tz as h, null::timestamptz as fin
    from intervalos_trabajo(p_business_id, p_fecha) t,
         unnest(s.fixed_slot_times) as x(turno)
    where s.fixed_slot_times is not null
      and (p_fecha + x.turno) at time zone v_tz >= t.ini
      and (p_fecha + x.turno) at time zone v_tz <  t.fin
  )
  select c.h from candidatos c
  where c.h >= v_min
    and (c.fin is null or c.h + make_interval(mins => p_duracion_minutos) <= c.fin)
    and not exists (
      select 1 from appointments a
      where a.business_id = p_business_id
        and a.status in ('PENDIENTE','CONFIRMADA','EN_CURSO')
        and tstzrange(a.starts_at, a.blocked_until)
            && tstzrange(c.h, c.h + make_interval(mins => p_duracion_minutos + v_buffer)))
    and not exists (
      select 1 from blocks b
      where b.business_id = p_business_id
        and tstzrange(b.starts_at, b.ends_at)
            && tstzrange(c.h, c.h + make_interval(mins => p_duracion_minutos + v_buffer)))
    and not exists (
      select 1 from holds hl
      where hl.business_id = p_business_id and hl.expires_at > now()
        and tstzrange(hl.starts_at, hl.ends_at)
            && tstzrange(c.h, c.h + make_interval(mins => p_duracion_minutos + v_buffer)))
  order by c.h;
end $function$;
