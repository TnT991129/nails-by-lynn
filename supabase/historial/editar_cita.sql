-- La clienta cambia los servicios, complementos o la nota de su cita desde su enlace.
-- Mismo plazo que para cambiar la fecha (settings.reschedule_min_hours) y no gasta cambios de fecha.
-- Precio y duración se recalculan aquí desde la base, nunca desde el móvil.
-- Ejecutar una vez en Supabase → SQL Editor (después de rango_en_citas.sql).

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

  -- 1) Validar y sumar duración y precio con los datos reales
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

  v_antes := jsonb_build_object('servicios',
    (select string_agg(service_name_snapshot, ' + ' order by sort_order) from appointment_items where appointment_id = a.id),
    'total', a.total_amount, 'nota', a.client_note);

  -- 2) Guardar: si la cita ahora dura más y choca con la siguiente, la restricción lo impide
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

  -- 3) Cambiar las líneas de servicio (los complementos se borran en cascada)
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

  -- Total máximo (precios en rango), si ya está instalado rango_en_citas.sql
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
