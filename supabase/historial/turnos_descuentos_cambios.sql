-- Turnos a las 10:00 y 13:00, descuentos para la próxima cita y un cambio de cita al mes.
-- Ejecutar una vez en Supabase → SQL Editor (todo el archivo de una vez).

-- =====================================================================
-- 1. TURNOS: 10:00 AM y 1:00 PM (Lynn podrá cambiarlos luego desde el panel)
-- =====================================================================
update settings set fixed_slot_times = array['10:00','13:00']::time[]
 where business_id = '1a115b41-0000-4000-8000-000000000001';

-- Horas de turno y días de trabajo para la web pública (settings es privada)
create or replace function public.obtener_turnos(p_business_id uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select jsonb_build_object(
    'turnos', coalesce((select jsonb_agg(to_char(t, 'HH24:MI') order by t)
                        from unnest(s.fixed_slot_times) as t), '[]'::jsonb))
  from settings s where s.business_id = p_business_id
$$;
grant execute on function public.obtener_turnos(uuid) to anon, authenticated;

-- =====================================================================
-- 2. DESCUENTOS PARA LA PRÓXIMA CITA
-- =====================================================================
alter table clients add column if not exists next_discount_percent numeric(5,2);
alter table clients add column if not exists next_discount_note text;
alter table clients add column if not exists next_discount_at timestamptz;
alter table clients drop constraint if exists clients_descuento_valido;
alter table clients add constraint clients_descuento_valido
  check (next_discount_percent is null or (next_discount_percent > 0 and next_discount_percent <= 100));

alter table appointments add column if not exists discount_percent numeric(5,2) not null default 0;
alter table appointments add column if not exists discount_amount numeric(12,2) not null default 0;

-- La web pregunta si ese teléfono tiene descuento para mostrarlo en el resumen (solo devuelve el %)
create or replace function public.descuento_pendiente(p_business_id uuid, p_telefono text)
 returns numeric
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select c.next_discount_percent from clients c
   where c.business_id = p_business_id and c.phone = normalizar_telefono(p_telefono)
     and not c.is_blocked
$$;
grant execute on function public.descuento_pendiente(uuid, text) to anon, authenticated;

-- crear_cita: igual que antes + aplica y consume el descuento pendiente de la clienta
create or replace function public.crear_cita(p_business_id uuid, p_session_token text, p_inicio timestamp with time zone, p_items jsonb, p_nombre text, p_telefono text, p_email text default null::text, p_instagram text default null::text, p_nota text default null::text, p_origen origen_cita default 'WEB'::origen_cita, p_device_id text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  s settings%rowtype; b businesses%rowtype;
  v_tel text; v_client clients%rowtype; v_hold holds%rowtype;
  v_dur int := 0; v_buffer int := 0; v_total numeric(12,2) := 0;
  v_item jsonb; v_srv services%rowtype; v_addon service_addons%rowtype; v_addon_id uuid;
  v_ap_id uuid; v_item_id uuid; v_code text; v_token text;
  v_fin timestamptz; v_bloq timestamptz;
  v_tasa numeric(12,4); v_tasa_fecha date; v_anticipo numeric(12,2) := 0;
  v_activas int; v_recientes int; v_intentos int := 0; v_ok boolean := false;
  v_off int; v_moneda moneda;
  v_desc_pct numeric(5,2) := 0; v_desc numeric(12,2) := 0;
begin
  select * into b from businesses where id = p_business_id;
  if not found then raise exception 'NEGOCIO_NO_EXISTE'; end if;
  if not b.is_accepting_bookings then raise exception 'RESERVAS_CERRADAS'; end if;
  select * into s from settings where business_id = p_business_id;

  -- E5: hold vivo de esta sesion
  select * into v_hold from holds
   where business_id = p_business_id and session_token = p_session_token and expires_at > now();
  if not found and p_origen = 'WEB' then raise exception 'RETENCION_VENCIDA'; end if;

  -- Sumar duracion y precio desde los servicios reales (nunca desde el cliente)
  if jsonb_array_length(p_items) = 0 then raise exception 'SIN_SERVICIOS'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_srv from services
     where id = (v_item->>'service_id')::uuid and business_id = p_business_id and is_active;
    if not found then raise exception 'SERVICIO_NO_DISPONIBLE'; end if;
    v_dur := v_dur + v_srv.duration_minutes;
    v_total := v_total + v_srv.price;
    v_buffer := greatest(v_buffer, v_srv.buffer_after_minutes);
    v_moneda := v_srv.currency;
    if v_item ? 'addons' then
      for v_addon_id in select (jsonb_array_elements_text(v_item->'addons'))::uuid loop
        select * into v_addon from service_addons
         where id = v_addon_id and business_id = p_business_id and is_active;
        if not found then raise exception 'ADDON_NO_DISPONIBLE'; end if;
        v_dur := v_dur + v_addon.extra_minutes;
        v_total := v_total + v_addon.extra_price;
      end loop;
    end if;
  end loop;
  if v_buffer = 0 then v_buffer := s.default_buffer_minutes; end if;

  v_fin  := p_inicio + make_interval(mins => v_dur);
  v_bloq := v_fin + make_interval(mins => v_buffer);

  -- E1/E2: ventanas de antelacion
  if p_origen = 'WEB' then
    if p_inicio < now() + make_interval(hours => s.min_advance_hours) then
      raise exception 'DEMASIADO_PRONTO'; end if;
    if p_inicio::date > (now() + make_interval(days => s.max_advance_days))::date then
      raise exception 'DEMASIADO_LEJOS'; end if;
  end if;

  -- Clienta: crear o reutilizar por telefono normalizado
  v_tel := normalizar_telefono(p_telefono);
  if v_tel is null then raise exception 'TELEFONO_INVALIDO'; end if;
  select * into v_client from clients where business_id = p_business_id and phone = v_tel;
  if not found then
    insert into clients (business_id, full_name, phone, email, instagram)
    values (p_business_id, p_nombre, v_tel, p_email, p_instagram)
    returning * into v_client;
  else
    if v_client.is_blocked then raise exception 'CLIENTA_BLOQUEADA'; end if;
  end if;

  -- Descuento pendiente de la clienta (lo da Lynn desde el panel)
  if coalesce(v_client.next_discount_percent, 0) > 0 then
    v_desc_pct := v_client.next_discount_percent;
    v_desc := round(v_total * v_desc_pct / 100, 2);
    v_total := v_total - v_desc;
  end if;

  -- E6/E7: limites antifraude
  if p_origen = 'WEB' then
    select count(*) into v_activas from appointments
     where client_id = v_client.id and status in ('PENDIENTE','CONFIRMADA') and starts_at > now();
    if v_activas >= s.max_active_appointments_per_phone then raise exception 'LIMITE_CITAS_ACTIVAS'; end if;
    if p_device_id is not null then
      select count(*) into v_recientes from audit_log
       where business_id = p_business_id and action = 'cita.creada'
         and after->>'device_id' = p_device_id and created_at > now() - interval '24 hours';
      if v_recientes >= s.max_bookings_per_device_24h then raise exception 'LIMITE_DISPOSITIVO'; end if;
    end if;
  end if;

  -- Tasa del dia congelada
  select cup_per_usd, effective_date into v_tasa, v_tasa_fecha from exchange_rates
   where business_id = p_business_id and effective_date <= (now() at time zone b.timezone)::date
   order by effective_date desc limit 1;

  -- Anticipo (sobre el total ya con descuento)
  if s.deposit_enabled then
    if s.deposit_mode = 'FIJO' then v_anticipo := least(coalesce(s.deposit_value,0), v_total);
    elsif s.deposit_mode = 'PORCENTAJE' then v_anticipo := round(v_total * coalesce(s.deposit_value,0)/100, 2);
    end if;
  end if;

  -- Insertar cita (la restriccion EXCLUDE decide) con reintento de codigo unico
  while v_intentos < 8 and not v_ok loop
    v_intentos := v_intentos + 1;
    v_code := generar_codigo_cita();
    v_token := encode(gen_random_bytes(24), 'hex');
    begin
      insert into appointments (business_id, client_id, code, access_token, starts_at, ends_at,
        blocked_until, total_duration_minutes, status, source, total_amount, currency,
        exchange_rate_used, exchange_rate_date, deposit_amount, balance_due, client_note,
        policies_accepted_at, discount_percent, discount_amount)
      values (p_business_id, v_client.id, v_code, v_token, p_inicio, v_fin, v_bloq, v_dur,
        case when s.deposit_enabled and v_anticipo > 0 then 'PENDIENTE'::estado_cita
             else 'CONFIRMADA'::estado_cita end,
        p_origen, v_total, coalesce(v_moneda, b.default_currency), v_tasa, v_tasa_fecha,
        v_anticipo, v_total - v_anticipo, p_nota, now(), v_desc_pct, v_desc)
      returning id into v_ap_id;
      v_ok := true;
    exception
      when unique_violation then null;  -- codigo repetido: reintentar
      when exclusion_violation then raise exception 'HORARIO_YA_TOMADO';
    end;
  end loop;
  if not v_ok then raise exception 'NO_SE_PUDO_GENERAR_CODIGO'; end if;

  -- El descuento ya se usó
  if v_desc_pct > 0 then
    update clients set next_discount_percent = null, next_discount_note = null, next_discount_at = null
     where id = v_client.id;
  end if;

  -- Lineas de servicio con precios congelados
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_srv from services where id = (v_item->>'service_id')::uuid;
    insert into appointment_items (appointment_id, service_id, service_name_snapshot,
      duration_minutes_snapshot, price_snapshot, currency_snapshot)
    values (v_ap_id, v_srv.id, v_srv.name, v_srv.duration_minutes, v_srv.price, v_srv.currency)
    returning id into v_item_id;
    if v_item ? 'addons' then
      for v_addon_id in select (jsonb_array_elements_text(v_item->'addons'))::uuid loop
        select * into v_addon from service_addons where id = v_addon_id;
        insert into appointment_item_addons (appointment_item_id, addon_id, name_snapshot,
          extra_minutes_snapshot, extra_price_snapshot)
        values (v_item_id, v_addon.id, v_addon.name, v_addon.extra_minutes, v_addon.extra_price);
      end loop;
    end if;
  end loop;

  -- Pago
  insert into payments (business_id, appointment_id, type, amount, currency, exchange_rate_used, status)
  values (p_business_id, v_ap_id,
          case when v_anticipo > 0 then 'ANTICIPO'::tipo_pago else 'PAGO_TOTAL'::tipo_pago end,
          case when v_anticipo > 0 then v_anticipo else v_total end,
          coalesce(v_moneda, b.default_currency), v_tasa, 'PENDIENTE');

  -- Liberar hold
  delete from holds where session_token = p_session_token;

  -- Notificaciones
  insert into notifications (business_id, appointment_id, recipient_type, recipient_phone,
    template_key, rendered_message, scheduled_for)
  values (p_business_id, v_ap_id, 'CLIENTA', v_tel, 'confirmacion',
    format('Tu cita con %s esta confirmada. %s a las %s. Ver tu cita: /cita/%s',
      b.name, to_char(p_inicio at time zone b.timezone, 'DD/MM'),
      to_char(p_inicio at time zone b.timezone, 'HH12:MI AM'), v_token), now()),
   (p_business_id, v_ap_id, 'PROFESIONAL', b.phone_whatsapp, 'aviso_nueva',
    format('Nueva reserva: %s - %s %s', p_nombre,
      to_char(p_inicio at time zone b.timezone, 'DD/MM'),
      to_char(p_inicio at time zone b.timezone, 'HH12:MI AM')), now());

  foreach v_off in array s.reminder_offsets_hours loop
    if p_inicio - make_interval(hours => v_off) > now() then
      insert into notifications (business_id, appointment_id, recipient_type, recipient_phone,
        template_key, rendered_message, scheduled_for)
      values (p_business_id, v_ap_id, 'CLIENTA', v_tel, 'recordatorio_' || v_off || 'h',
        format('Recordatorio: tu cita con %s es el %s a las %s', b.name,
          to_char(p_inicio at time zone b.timezone, 'DD/MM'),
          to_char(p_inicio at time zone b.timezone, 'HH12:MI AM')),
        p_inicio - make_interval(hours => v_off));
    end if;
  end loop;

  insert into audit_log (business_id, actor_type, action, entity_type, entity_id, after)
  values (p_business_id, 'CLIENTA', 'cita.creada', 'appointment', v_ap_id,
          jsonb_build_object('code', v_code, 'inicio', p_inicio, 'device_id', p_device_id));

  return jsonb_build_object('id', v_ap_id, 'code', v_code, 'access_token', v_token,
    'inicio', p_inicio, 'fin', v_fin, 'duracion_minutos', v_dur,
    'total', v_total, 'anticipo', v_anticipo, 'saldo', v_total - v_anticipo,
    'descuento_porcentaje', v_desc_pct, 'descuento_monto', v_desc);
end $function$;

-- Agenda del panel: añade el descuento de cada cita (columnas nuevas al final)
create or replace view public.v_agenda with (security_invoker=true) as
 SELECT a.id, a.business_id, a.code, a.starts_at, a.ends_at, a.blocked_until, a.status, a.source,
    a.total_amount, a.currency, a.deposit_amount, a.balance_due, a.total_duration_minutes,
    a.client_note, a.internal_note,
    c.full_name AS cliente_nombre, c.phone AS cliente_telefono, c.id AS client_id,
    ( SELECT string_agg(i.service_name_snapshot, ' + '::text ORDER BY i.sort_order)
        FROM appointment_items i WHERE i.appointment_id = a.id) AS servicios,
    a.discount_percent, a.discount_amount, a.reschedule_count
   FROM appointments a
   JOIN clients c ON c.id = a.client_id;

-- =====================================================================
-- 3. UN CAMBIO DE CITA AL MES POR CLIENTA
-- =====================================================================
alter table settings add column if not exists max_reschedules_per_month integer not null default 1;

-- Cuántos cambios hizo la clienta ella misma este mes (hora de La Habana)
create or replace function public.cambios_clienta_mes(p_client_id uuid)
 returns integer
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select count(*)::int
  from audit_log l
  join appointments x on x.id = l.entity_id
  join businesses b on b.id = x.business_id
  where l.action = 'cita.reprogramada' and l.actor_type = 'CLIENTA'
    and x.client_id = p_client_id
    and l.created_at >= (date_trunc('month', now() at time zone b.timezone) at time zone b.timezone)
$$;
revoke execute on function public.cambios_clienta_mes(uuid) from public, anon;
grant  execute on function public.cambios_clienta_mes(uuid) to authenticated;

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
    'descuento_porcentaje', a.discount_percent, 'descuento_monto', a.discount_amount,
    'cliente', jsonb_build_object('nombre', c.full_name, 'telefono', c.phone),
    'negocio', jsonb_build_object('nombre', b.name, 'ubicacion', b.location_label,
                                  'whatsapp', b.phone_whatsapp, 'zona', b.timezone),
    'servicios', (select jsonb_agg(jsonb_build_object('nombre', i.service_name_snapshot,
                    'precio', i.price_snapshot) order by i.sort_order)
                  from appointment_items i where i.appointment_id = a.id),
    'reprogramaciones', a.reschedule_count,
    'max_reprogramaciones', s.max_reschedules,
    'horas_minimas_reprogramar', s.reschedule_min_hours,
    'cambio_mes_disponible', cambios_clienta_mes(a.client_id) < s.max_reschedules_per_month)
  into v
  from appointments a
  join clients c on c.id = a.client_id
  join businesses b on b.id = a.business_id
  join settings s on s.business_id = a.business_id
  where a.access_token = p_token;
  if v is null then raise exception 'CITA_NO_ENCONTRADA'; end if;
  return v;
end $function$;

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
  -- Un cambio al mes por clienta (se cuentan todas sus citas)
  if cambios_clienta_mes(a.client_id) >= s.max_reschedules_per_month then
    raise exception 'LIMITE_REPROGRAMACIONES_MES';
  end if;

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

-- =====================================================================
-- 4. POLÍTICAS: tildes, regla de un cambio al mes y sin mencionar anticipos (están desactivados)
-- =====================================================================
update settings set
  policy_cancellation = 'Puedes cancelar sin costo hasta 24 horas antes. Si faltan menos de 2 horas, escríbeme por WhatsApp.',
  policy_reschedule   = 'Puedes cambiar la fecha u hora de tu cita desde tu enlace hasta 24 horas antes. Cada clienta puede hacer un cambio al mes.',
  policy_no_show      = null,
  policy_deposit      = null,
  privacy_notice      = 'Guardamos tu nombre, teléfono e historial de citas únicamente para gestionar tus reservas.'
 where business_id = '1a115b41-0000-4000-8000-000000000001';
