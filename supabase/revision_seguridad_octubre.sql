-- Revisión de octubre: seguridad de las reservas y correcciones de datos.
-- Ejecutar una vez en Supabase → SQL Editor (todo el archivo de una vez), después de editar_cita.sql.
--
-- 1. crear_cita: solo Lynn puede usar un origen distinto de WEB (antes cualquiera podía saltarse
--    la retención, la antelación y los límites mandando p_origen = 'MANUAL').
-- 2. crear_hold: solo retiene turnos que la web ofrecería como libres (día de trabajo, no cerrado,
--    antelación) y como máximo 3 retenciones a la vez por conexión.
-- 3. crear_cita: la retención tiene que cubrir la duración real de la cita.
-- 4. validar_turno: la excepción de horario es para Lynn, no para cualquier sesión iniciada.
-- 5. Lectura pública del negocio y de los días cerrados: solo las columnas que usa la web
--    (la dirección exacta, coordenadas y motivos de cierre ya no se ven).
-- 6. editar_cita: no puede pisar un bloqueo y actualiza el pago pendiente.
-- 7. Contadores de la clienta: se corrigen si Lynn deshace «Completada», «No asistió» o una cancelación.
-- 8. Recordatorios automáticos que nadie enviaba (recordatorio_24h, recordatorio_2h): ya no se crean.
-- 9. Lo que faltaba de mejoras.sql (nunca se llegó a aplicar): alergias, cumpleaños y reseñas.
--    No hace falta ejecutar mejoras.sql: su versión de obtener_cita_por_token es más antigua
--    que la que ya está instalada y quitaría los precios en rango.

-- =====================================================================
-- IP de la petición (PostgREST pasa las cabeceras HTTP)
-- =====================================================================
create or replace function public.ip_peticion()
 returns text
 language sql stable
 set search_path to 'public'
as $$
  select nullif(trim(split_part(coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)), '')
$$;
revoke all on function public.ip_peticion() from public, anon, authenticated;

alter table holds add column if not exists ip text;
create index if not exists holds_ip_idx on holds (business_id, ip, expires_at);

-- =====================================================================
-- 2. crear_hold
-- =====================================================================
create or replace function public.crear_hold(p_business_id uuid, p_inicio timestamp with time zone, p_duracion_minutos integer, p_session_token text, p_buffer_minutos integer default null::integer)
 returns table(hold_id uuid, expira_en timestamp with time zone)
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare s settings%rowtype; v_tz text; v_buffer int; v_fin timestamptz; v_exp timestamptz; v_id uuid; v_ip text;
begin
  if p_duracion_minutos is null or p_duracion_minutos <= 0 or p_duracion_minutos > 720 then
    raise exception 'HORARIO_NO_DISPONIBLE';
  end if;
  if p_session_token is null or length(p_session_token) < 16 then raise exception 'RETENCION_VENCIDA'; end if;

  delete from holds where business_id = p_business_id and expires_at < now();
  delete from holds where session_token = p_session_token;

  select * into s from settings where business_id = p_business_id;
  if not found then raise exception 'NEGOCIO_NO_EXISTE'; end if;
  select timezone into v_tz from businesses where id = p_business_id;

  v_buffer := greatest(coalesce(p_buffer_minutos, s.default_buffer_minutes), 0);
  v_fin := p_inicio + make_interval(mins => p_duracion_minutos + v_buffer);
  v_exp := now() + make_interval(mins => s.hold_minutes);
  v_ip  := ip_peticion();

  if not es_profesional(p_business_id) then
    -- Mismas reglas que la web: solo turnos que obtener_disponibilidad ofrece
    if not exists (
      select 1 from obtener_disponibilidad(p_business_id, (p_inicio at time zone v_tz)::date,
                                           p_duracion_minutos, v_buffer) d
      where d.hora = p_inicio) then
      raise exception 'HORARIO_NO_DISPONIBLE';
    end if;
    -- Nadie puede retener media agenda a la vez
    if v_ip is not null and (select count(*) from holds
        where business_id = p_business_id and ip = v_ip and expires_at > now()) >= 3 then
      raise exception 'DEMASIADAS_RETENCIONES';
    end if;
  end if;

  if exists (select 1 from appointments a
      where a.business_id = p_business_id and a.status in ('PENDIENTE','CONFIRMADA','EN_CURSO')
        and tstzrange(a.starts_at, a.blocked_until) && tstzrange(p_inicio, v_fin))
     or exists (select 1 from blocks b where b.business_id = p_business_id
        and tstzrange(b.starts_at, b.ends_at) && tstzrange(p_inicio, v_fin))
     or exists (select 1 from holds h where h.business_id = p_business_id and h.expires_at > now()
        and tstzrange(h.starts_at, h.ends_at) && tstzrange(p_inicio, v_fin)) then
    raise exception 'HORARIO_NO_DISPONIBLE';
  end if;

  insert into holds (business_id, session_token, starts_at, ends_at, expires_at, ip)
  values (p_business_id, p_session_token, p_inicio, v_fin, v_exp, v_ip)
  returning id into v_id;

  return query select v_id, v_exp;
end $function$;

-- =====================================================================
-- 1 y 3. crear_cita
-- =====================================================================
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
  v_moneda moneda; v_orden int := 0;
  v_desc_pct numeric(5,2) := 0; v_desc numeric(12,2) := 0;
  v_web boolean := p_origen = 'WEB';
  v_nombre text := left(trim(coalesce(p_nombre, '')), 80);
begin
  select * into b from businesses where id = p_business_id;
  if not found then raise exception 'NEGOCIO_NO_EXISTE'; end if;
  -- Solo Lynn crea citas manuales (sin retención, sin antelación y sin límites)
  if not v_web and not es_profesional(p_business_id) then raise exception 'NO_AUTORIZADA'; end if;
  if v_web and not b.is_accepting_bookings then raise exception 'RESERVAS_CERRADAS'; end if;
  select * into s from settings where business_id = p_business_id;

  if length(v_nombre) < 2 then raise exception 'NOMBRE_INVALIDO'; end if;

  -- Hold vivo de esta sesion, a la misma hora
  if v_web then
    select * into v_hold from holds
     where business_id = p_business_id and session_token = p_session_token and expires_at > now();
    if not found or v_hold.starts_at <> p_inicio then raise exception 'RETENCION_VENCIDA'; end if;
  end if;

  -- Sumar duracion y precio desde los servicios reales (nunca desde el cliente)
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'SIN_SERVICIOS'; end if;
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

  if v_web then
    -- La retención tiene que cubrir la cita entera (la duración del hold la manda el móvil)
    if v_hold.ends_at < v_bloq then raise exception 'RETENCION_VENCIDA'; end if;
    if p_inicio < now() + make_interval(hours => s.min_advance_hours) then
      raise exception 'DEMASIADO_PRONTO'; end if;
    if p_inicio::date > (now() + make_interval(days => s.max_advance_days))::date then
      raise exception 'DEMASIADO_LEJOS'; end if;
  end if;

  -- Clienta: crear o reutilizar por telefono normalizado
  v_tel := normalizar_telefono(p_telefono);
  if v_tel is null or length(regexp_replace(v_tel, '\D', '', 'g')) < 10 then raise exception 'TELEFONO_INVALIDO'; end if;
  select * into v_client from clients where business_id = p_business_id and phone = v_tel;
  if not found then
    insert into clients (business_id, full_name, phone, email, instagram)
    values (p_business_id, v_nombre, v_tel, nullif(left(trim(coalesce(p_email, '')), 120), ''),
            nullif(left(trim(coalesce(p_instagram, '')), 60), ''))
    returning * into v_client;
  elsif v_client.is_blocked and v_web then
    raise exception 'CLIENTA_BLOQUEADA';
  end if;

  -- Descuento pendiente de la clienta (lo da Lynn desde el panel)
  if coalesce(v_client.next_discount_percent, 0) > 0 then
    v_desc_pct := v_client.next_discount_percent;
    v_desc := round(v_total * v_desc_pct / 100, 2);
    v_total := v_total - v_desc;
  end if;

  -- Limites antifraude
  if v_web then
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
        v_anticipo, v_total - v_anticipo, nullif(left(trim(coalesce(p_nota, '')), 500), ''),
        now(), v_desc_pct, v_desc)
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

  -- Lineas de servicio con precios congelados, en el orden elegido
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_orden := v_orden + 1;
    select * into v_srv from services where id = (v_item->>'service_id')::uuid;
    insert into appointment_items (appointment_id, service_id, service_name_snapshot,
      duration_minutes_snapshot, price_snapshot, currency_snapshot, sort_order)
    values (v_ap_id, v_srv.id, v_srv.name, v_srv.duration_minutes, v_srv.price, v_srv.currency, v_orden)
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
  if v_web then delete from holds where session_token = p_session_token; end if;

  -- Avisos (los recordatorios los manda Lynn desde el panel)
  insert into notifications (business_id, appointment_id, recipient_type, recipient_phone,
    template_key, rendered_message, scheduled_for)
  values (p_business_id, v_ap_id, 'CLIENTA', v_tel, 'confirmacion',
    format('Tu cita con %s esta confirmada. %s a las %s. Ver tu cita: /cita/%s',
      b.name, to_char(p_inicio at time zone b.timezone, 'DD/MM'),
      to_char(p_inicio at time zone b.timezone, 'HH12:MI AM'), v_token), now()),
   (p_business_id, v_ap_id, 'PROFESIONAL', b.phone_whatsapp, 'aviso_nueva',
    format('Nueva reserva: %s - %s %s', v_nombre,
      to_char(p_inicio at time zone b.timezone, 'DD/MM'),
      to_char(p_inicio at time zone b.timezone, 'HH12:MI AM')), now());

  insert into audit_log (business_id, actor_type, action, entity_type, entity_id, after)
  values (p_business_id, case when v_web then 'CLIENTA'::tipo_actor else 'PROFESIONAL'::tipo_actor end,
          'cita.creada', 'appointment', v_ap_id,
          jsonb_build_object('code', v_code, 'inicio', p_inicio, 'device_id', p_device_id));

  return jsonb_build_object('id', v_ap_id, 'code', v_code, 'access_token', v_token,
    'inicio', p_inicio, 'fin', v_fin, 'duracion_minutos', v_dur,
    'total', v_total, 'anticipo', v_anticipo, 'saldo', v_total - v_anticipo,
    'descuento_porcentaje', v_desc_pct, 'descuento_monto', v_desc);
end $function$;

-- =====================================================================
-- 4. validar_turno: la excepción es para la profesional
-- =====================================================================
create or replace function public.validar_turno()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $$
begin
  if tg_op = 'UPDATE' and new.starts_at = old.starts_at then return new; end if;
  if not es_profesional(new.business_id) and not es_turno_valido(new.business_id, new.starts_at) then
    raise exception 'HORARIO_NO_DISPONIBLE';
  end if;
  return new;
end $$;

-- =====================================================================
-- 5. Lectura pública por columnas
-- =====================================================================
revoke select on public.businesses from anon;
grant select (id, slug, name, tagline, description, logo_url, hero_image_url, phone_whatsapp,
              instagram_url, location_label, timezone, default_currency, is_accepting_bookings,
              closed_message) on public.businesses to anon;

revoke select on public.schedule_exceptions from anon;
grant select (id, business_id, date_from, date_to, type, start_time, end_time)
  on public.schedule_exceptions to anon;

-- =====================================================================
-- 6. editar_cita
-- =====================================================================
create or replace function public.editar_cita(p_token text, p_items jsonb, p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a appointments%rowtype; s settings%rowtype;
  v_item jsonb; v_srv services%rowtype; v_addon service_addons%rowtype; v_addon_id uuid; v_item_id uuid;
  v_dur int := 0; v_buffer int := 0; v_total numeric(12,2) := 0; v_desc numeric(12,2);
  v_fin timestamptz; v_bloq timestamptz; v_orden int := 0;
  v_antes jsonb;
begin
  select * into a from appointments where access_token = p_token for update;
  if not found then raise exception 'CITA_NO_ENCONTRADA'; end if;
  if a.status not in ('PENDIENTE', 'CONFIRMADA') then raise exception 'CITA_NO_EDITABLE'; end if;
  select * into s from settings where business_id = a.business_id;
  if a.starts_at < now() + make_interval(hours => s.reschedule_min_hours) then raise exception 'EDICION_FUERA_DE_PLAZO'; end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'SIN_SERVICIOS'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_srv from services
     where id = (v_item->>'service_id')::uuid and business_id = a.business_id and is_active;
    if not found then raise exception 'SERVICIO_NO_DISPONIBLE'; end if;
    v_dur := v_dur + v_srv.duration_minutes;
    v_total := v_total + v_srv.price;
    v_buffer := greatest(v_buffer, v_srv.buffer_after_minutes);
    if v_item ? 'addons' then
      for v_addon_id in select (jsonb_array_elements_text(v_item->'addons'))::uuid loop
        select * into v_addon from service_addons
         where id = v_addon_id and business_id = a.business_id and is_active;
        if not found then raise exception 'ADDON_NO_DISPONIBLE'; end if;
        v_dur := v_dur + v_addon.extra_minutes;
        v_total := v_total + v_addon.extra_price;
      end loop;
    end if;
  end loop;
  if v_buffer = 0 then v_buffer := s.default_buffer_minutes; end if;

  v_fin  := a.starts_at + make_interval(mins => v_dur);
  v_bloq := v_fin + make_interval(mins => v_buffer);
  v_desc := round(v_total * coalesce(a.discount_percent, 0) / 100, 2);

  -- Si se alarga, no puede pisar un rato bloqueado por Lynn
  if exists (select 1 from blocks bl where bl.business_id = a.business_id
              and tstzrange(bl.starts_at, bl.ends_at) && tstzrange(a.starts_at, v_bloq)) then
    raise exception 'NO_CABE_EN_EL_TURNO';
  end if;

  v_antes := jsonb_build_object('servicios',
    (select string_agg(service_name_snapshot, ' + ' order by sort_order) from appointment_items where appointment_id = a.id),
    'total', a.total_amount, 'nota', a.client_note);

  begin
    update appointments
       set ends_at = v_fin, blocked_until = v_bloq, total_duration_minutes = v_dur,
           total_amount = v_total - v_desc, discount_amount = v_desc,
           balance_due = greatest(v_total - v_desc - deposit_amount, 0),
           client_note = nullif(left(trim(coalesce(p_nota, '')), 500), '')
     where id = a.id;
  exception when exclusion_violation then
    raise exception 'NO_CABE_EN_EL_TURNO';
  end;

  -- El pago pendiente refleja el nuevo total
  update payments set amount = v_total - v_desc
   where appointment_id = a.id and status = 'PENDIENTE' and type = 'PAGO_TOTAL';

  delete from appointment_items where appointment_id = a.id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_orden := v_orden + 1;
    select * into v_srv from services where id = (v_item->>'service_id')::uuid;
    insert into appointment_items (appointment_id, service_id, service_name_snapshot,
      duration_minutes_snapshot, price_snapshot, currency_snapshot, sort_order)
    values (a.id, v_srv.id, v_srv.name, v_srv.duration_minutes, v_srv.price, v_srv.currency, v_orden)
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

  if to_regprocedure('public.recalcular_total_maximo(uuid)') is not null then
    execute 'select public.recalcular_total_maximo($1)' using a.id;
  end if;

  insert into audit_log (business_id, actor_type, action, entity_type, entity_id, before, after)
  values (a.business_id, 'CLIENTA', 'cita.editada', 'appointment', a.id, v_antes,
          jsonb_build_object('total', v_total - v_desc, 'duracion', v_dur, 'nota', p_nota));

  return jsonb_build_object('ok', true, 'total', v_total - v_desc, 'duracion', v_dur);
end $$;

revoke all on function public.editar_cita(text, jsonb, text) from public;
grant execute on function public.editar_cita(text, jsonb, text) to anon, authenticated;

-- =====================================================================
-- 7. Contadores de la clienta: también al deshacer un estado
-- =====================================================================
create or replace function public.tg_contadores_clienta()
 returns trigger
 language plpgsql
as $function$
declare v_monto_viejo numeric; v_monto_nuevo numeric;
begin
  if TG_OP = 'UPDATE' and new.status is distinct from old.status then
    v_monto_viejo := case when old.currency = 'CUP' then old.total_amount
                          else old.total_amount * coalesce(old.exchange_rate_used, 1) end;
    v_monto_nuevo := case when new.currency = 'CUP' then new.total_amount
                          else new.total_amount * coalesce(new.exchange_rate_used, 1) end;

    -- Deshacer lo que sumó el estado anterior
    if old.status = 'COMPLETADA' then
      update clients set total_appointments = greatest(total_appointments - 1, 0),
        total_spent_cup = greatest(total_spent_cup - v_monto_viejo, 0)
      where id = old.client_id;
    elsif old.status = 'CANCELADA_CLIENTA' then
      update clients set total_cancellations = greatest(total_cancellations - 1, 0) where id = old.client_id;
    elsif old.status = 'NO_SHOW' then
      update clients set total_no_shows = greatest(total_no_shows - 1, 0) where id = old.client_id;
    end if;

    if new.status = 'COMPLETADA' then
      update clients set total_appointments = total_appointments + 1,
        total_spent_cup = total_spent_cup + v_monto_nuevo,
        last_appointment_at = greatest(coalesce(last_appointment_at, new.starts_at), new.starts_at)
      where id = new.client_id;
    elsif new.status = 'CANCELADA_CLIENTA' then
      update clients set total_cancellations = total_cancellations + 1 where id = new.client_id;
    elsif new.status = 'NO_SHOW' then
      update clients set total_no_shows = total_no_shows + 1 where id = new.client_id;
    end if;
  end if;
  return new;
end $function$;

-- =====================================================================
-- 8. Recordatorios automáticos sin uso
-- =====================================================================
create or replace function public.tg_descartar_recordatorios_auto()
 returns trigger
 language plpgsql
as $$
begin
  -- recordatorio_24h, recordatorio_2h… los creaba la base pero nadie los enviaba.
  -- El recordatorio real es 'recordatorio' (sin sufijo) y lo registra Lynn desde el panel.
  if new.template_key like 'recordatorio\_%' then return null; end if;
  return new;
end $$;

drop trigger if exists tg_descartar_recordatorios_auto on notifications;
create trigger tg_descartar_recordatorios_auto before insert on notifications
  for each row execute function tg_descartar_recordatorios_auto();

delete from notifications where template_key like 'recordatorio\_%' and status <> 'ENVIADA';

-- =====================================================================
-- 9. Lo pendiente de mejoras.sql: alergias, cumpleaños y reseñas
-- =====================================================================
alter table clients add column if not exists allergies text;
alter table clients add column if not exists birthday date;

-- La clienta valora su cita (solo si ya está completada). Puede cambiarla mientras Lynn no la publique.
create or replace function public.dejar_resena(p_token text, p_estrellas int, p_comentario text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a appointments%rowtype; v_publicada boolean;
begin
  select * into a from appointments where access_token = p_token;
  if not found then raise exception 'CITA_NO_ENCONTRADA'; end if;
  if a.status <> 'COMPLETADA' then raise exception 'RESENA_NO_DISPONIBLE'; end if;
  if p_estrellas is null or p_estrellas < 1 or p_estrellas > 5 then raise exception 'RESENA_INVALIDA'; end if;

  select is_published into v_publicada from reviews where appointment_id = a.id;
  if coalesce(v_publicada, false) then raise exception 'RESENA_YA_PUBLICADA'; end if;

  insert into reviews (business_id, appointment_id, client_id, rating, comment)
  values (a.business_id, a.id, a.client_id, p_estrellas, nullif(left(trim(coalesce(p_comentario, '')), 600), ''))
  on conflict (appointment_id) do update set rating = excluded.rating, comment = excluded.comment;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.dejar_resena(text, int, text) from public;
grant execute on function public.dejar_resena(text, int, text) to anon, authenticated;

-- Reseñas que Lynn publicó: solo nombre de pila, estrellas, comentario y fecha
create or replace function public.obtener_resenas(p_business_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'media',  (select round(avg(rating)::numeric, 1) from reviews where business_id = p_business_id and is_published),
    'total',  (select count(*) from reviews where business_id = p_business_id and is_published),
    'lista',  coalesce((select jsonb_agg(x order by x->>'fecha' desc) from (
                select jsonb_build_object('estrellas', r.rating, 'comentario', r.comment,
                         'nombre', split_part(trim(c.full_name), ' ', 1), 'fecha', r.published_at) as x
                from reviews r join clients c on c.id = r.client_id
                where r.business_id = p_business_id and r.is_published
                order by r.published_at desc limit 12) t), '[]'::jsonb))
$$;

revoke all on function public.obtener_resenas(uuid) from public;
grant execute on function public.obtener_resenas(uuid) to anon, authenticated;
