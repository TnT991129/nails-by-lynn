-- Correcciones de la revisión general. Ejecutar una vez en Supabase → SQL Editor.

-- crear_cita: la hora de la cita tiene que coincidir con la hora retenida por esa sesión.
-- (Resto de la función idéntico a supabase/turnos_descuentos_cambios.sql)
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
  -- La cita debe ser a la hora que se retuvo (no se puede reservar otra hora con una retención ajena)
  if p_origen = 'WEB' and v_hold.starts_at <> p_inicio then raise exception 'RETENCION_VENCIDA'; end if;

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
