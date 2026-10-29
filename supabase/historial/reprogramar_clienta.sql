-- La clienta puede cambiar su cita desde su enlace /cita/{token}.
-- Ejecutar una vez en Supabase → SQL Editor.

-- 1. obtener_cita_por_token: añade lo que la web necesita para ofrecer el cambio
--    (margen tras la cita y las reglas de reprogramación de settings).
create or replace function public.obtener_cita_por_token(p_token text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare v jsonb;
begin
  select jsonb_build_object('code', a.code, 'inicio', a.starts_at, 'fin', a.ends_at,
    'estado', a.status, 'duracion_minutos', a.total_duration_minutes,
    'margen_minutos', round(extract(epoch from (a.blocked_until - a.ends_at)) / 60)::int,
    'total', a.total_amount, 'moneda', a.currency, 'anticipo', a.deposit_amount,
    'saldo', a.balance_due, 'nota', a.client_note,
    'cliente', jsonb_build_object('nombre', c.full_name, 'telefono', c.phone),
    'negocio', jsonb_build_object('nombre', b.name, 'ubicacion', b.location_label,
                                  'whatsapp', b.phone_whatsapp, 'zona', b.timezone),
    'servicios', (select jsonb_agg(jsonb_build_object('nombre', i.service_name_snapshot,
                    'precio', i.price_snapshot) order by i.sort_order)
                  from appointment_items i where i.appointment_id = a.id),
    'reprogramaciones', a.reschedule_count,
    'max_reprogramaciones', s.max_reschedules,
    'horas_minimas_reprogramar', s.reschedule_min_hours)
  into v
  from appointments a
  join clients c on c.id = a.client_id
  join businesses b on b.id = a.business_id
  join settings s on s.business_id = a.business_id
  where a.access_token = p_token;
  if v is null then raise exception 'CITA_NO_ENCONTRADA'; end if;
  return v;
end $function$;

-- 2. reprogramar_cita: el nuevo turno debe estar realmente disponible
--    (día de trabajo, turno fijo, sin bloqueos ni retenciones de otras clientas),
--    se recrean los recordatorios y se avisa a Lynn.
create or replace function public.reprogramar_cita(p_token text, p_nuevo_inicio timestamp with time zone, p_session_token text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare a appointments%rowtype; s settings%rowtype; b businesses%rowtype; v_tel text;
        v_horas numeric; v_fin timestamptz; v_bloq timestamptz; v_buffer int; v_off int;
begin
  select * into a from appointments where access_token = p_token;
  if not found then raise exception 'CITA_NO_ENCONTRADA'; end if;
  if a.status not in ('PENDIENTE','CONFIRMADA') then raise exception 'CITA_NO_REPROGRAMABLE'; end if;
  select * into s from settings where business_id = a.business_id;
  select * into b from businesses where id = a.business_id;

  v_horas := extract(epoch from (a.starts_at - now())) / 3600.0;
  if v_horas < s.reschedule_min_hours then raise exception 'FUERA_DE_PLAZO'; end if;
  if a.reschedule_count >= s.max_reschedules then raise exception 'LIMITE_REPROGRAMACIONES'; end if;

  v_buffer := round(extract(epoch from (a.blocked_until - a.ends_at)) / 60)::int;

  -- Mismas reglas que al reservar: solo turnos que la web ofrecería como libres
  if not exists (
    select 1 from obtener_disponibilidad(a.business_id, (p_nuevo_inicio at time zone b.timezone)::date,
                                         a.total_duration_minutes, v_buffer) d
    where d.hora = p_nuevo_inicio) then
    raise exception 'HORARIO_NO_DISPONIBLE';
  end if;

  v_fin  := p_nuevo_inicio + make_interval(mins => a.total_duration_minutes);
  v_bloq := v_fin + make_interval(mins => v_buffer);

  begin
    update appointments set starts_at = p_nuevo_inicio, ends_at = v_fin, blocked_until = v_bloq,
      reschedule_count = a.reschedule_count + 1, updated_at = now()
    where id = a.id;
  exception when exclusion_violation then raise exception 'HORARIO_YA_TOMADO';
  end;

  if p_session_token is not null then delete from holds where session_token = p_session_token; end if;

  -- Recordatorios: se anulan los viejos y se programan los de la nueva fecha
  update notifications set status = 'OMITIDA'
   where appointment_id = a.id and status = 'PENDIENTE' and template_key like 'recordatorio%';
  select phone into v_tel from clients where id = a.client_id;
  foreach v_off in array s.reminder_offsets_hours loop
    if p_nuevo_inicio - make_interval(hours => v_off) > now() then
      insert into notifications (business_id, appointment_id, recipient_type, recipient_phone,
        template_key, rendered_message, scheduled_for)
      values (a.business_id, a.id, 'CLIENTA', v_tel, 'recordatorio_' || v_off || 'h',
        format('Recordatorio: tu cita con %s es el %s a las %s', b.name,
          to_char(p_nuevo_inicio at time zone b.timezone, 'DD/MM'),
          to_char(p_nuevo_inicio at time zone b.timezone, 'HH12:MI AM')),
        p_nuevo_inicio - make_interval(hours => v_off));
    end if;
  end loop;

  insert into notifications (business_id, appointment_id, recipient_type, recipient_phone,
    template_key, rendered_message, scheduled_for)
  values (a.business_id, a.id, 'PROFESIONAL', b.phone_whatsapp, 'aviso_reprogramada',
    format('La cita %s paso del %s %s al %s %s', a.code,
      to_char(a.starts_at at time zone b.timezone, 'DD/MM'), to_char(a.starts_at at time zone b.timezone, 'HH12:MI AM'),
      to_char(p_nuevo_inicio at time zone b.timezone, 'DD/MM'), to_char(p_nuevo_inicio at time zone b.timezone, 'HH12:MI AM')),
    now());

  insert into audit_log (business_id, actor_type, action, entity_type, entity_id, before, after)
  values (a.business_id, 'CLIENTA', 'cita.reprogramada', 'appointment', a.id,
          jsonb_build_object('inicio', a.starts_at), jsonb_build_object('inicio', p_nuevo_inicio));

  return jsonb_build_object('ok', true, 'inicio_anterior', a.starts_at, 'inicio_nuevo', p_nuevo_inicio,
    'reprogramaciones_usadas', a.reschedule_count + 1, 'maximo', s.max_reschedules);
end $function$;
