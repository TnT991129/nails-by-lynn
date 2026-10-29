-- Lynn edita los servicios de una cita desde el panel y las políticas pasan a secciones libres.
-- Ejecutar una vez en Supabase → SQL Editor (todo el archivo de una vez), después de
-- revision_seguridad_octubre.sql.

-- =====================================================================
-- 1. editar_cita_panel: como editar_cita, pero para Lynn
--    (sin plazo, también con la cita en curso, y sin la comprobación de bloqueos: ella decide)
-- =====================================================================
create or replace function public.editar_cita_panel(p_appointment_id uuid, p_items jsonb, p_nota text default null)
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
  select * into a from appointments where id = p_appointment_id for update;
  if not found then raise exception 'CITA_NO_ENCONTRADA'; end if;
  if not es_profesional(a.business_id) then raise exception 'NO_AUTORIZADA'; end if;
  if a.status not in ('PENDIENTE', 'CONFIRMADA', 'EN_CURSO') then raise exception 'CITA_NO_EDITABLE'; end if;
  select * into s from settings where business_id = a.business_id;

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

  perform recalcular_total_maximo(a.id);

  insert into audit_log (business_id, actor_id, actor_type, action, entity_type, entity_id, before, after)
  values (a.business_id, auth.uid(), 'PROFESIONAL', 'cita.editada', 'appointment', a.id, v_antes,
          jsonb_build_object('total', v_total - v_desc, 'duracion', v_dur, 'nota', p_nota));

  return jsonb_build_object('ok', true, 'total', v_total - v_desc, 'duracion', v_dur);
end $$;

revoke all on function public.editar_cita_panel(uuid, jsonb, text) from public, anon;
grant execute on function public.editar_cita_panel(uuid, jsonb, text) to authenticated;

-- =====================================================================
-- 2. Políticas en secciones libres: [{ "titulo": "...", "texto": "..." }, ...]
--    Null = la web sigue mostrando los textos de siempre (calculados con las reglas).
-- =====================================================================
alter table settings add column if not exists policy_sections jsonb;
alter table settings drop constraint if exists settings_secciones_lista;
alter table settings add constraint settings_secciones_lista
  check (policy_sections is null or jsonb_typeof(policy_sections) = 'array');

create or replace function public.obtener_politicas(p_business_id uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select jsonb_build_object(
    'cancelar_minimo_horas', s.cancel_blocked_hours,
    'cancelar_gratis_horas', s.cancel_free_hours,
    'cambiar_minimo_horas',  s.reschedule_min_hours,
    'max_cambios',           s.max_reschedules,
    'max_citas_activas',     s.max_active_appointments_per_phone,
    'max_dias_antelacion',   s.max_advance_days,
    'anticipo',              s.deposit_enabled,
    'secciones',             s.policy_sections,
    'textos', jsonb_build_object(
      'cancelacion', s.policy_cancellation, 'cambios',    s.policy_reschedule,
      'anticipo',    s.policy_deposit,      'no_show',    s.policy_no_show,
      'retrasos',    s.policy_late,         'reembolsos', s.policy_refund,
      'espera',      s.policy_waiting,      'privacidad', s.privacy_notice))
  from settings s where s.business_id = p_business_id
$$;

grant execute on function public.obtener_politicas(uuid) to anon, authenticated;
