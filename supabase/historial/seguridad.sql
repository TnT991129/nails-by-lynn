-- Correcciones de seguridad. Ejecutar una vez en Supabase → SQL Editor.

-- 1. exportar_respaldo: solo la profesional puede descargar el respaldo.
--    Antes cualquiera con la clave pública podía llamarla y obtener clientas, citas, pagos y gastos.
--    Además 'items' devolvía las líneas de todos los negocios; ahora solo las de este.
create or replace function public.exportar_respaldo(p_business_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not es_profesional(p_business_id) then raise exception 'NO_AUTORIZADA'; end if;
  return jsonb_build_object(
    'generado', now(), 'business_id', p_business_id,
    'businesses',   (select jsonb_agg(to_jsonb(t)) from businesses t where id = p_business_id),
    'settings',     (select jsonb_agg(to_jsonb(t)) from settings t where business_id = p_business_id),
    'services',     (select jsonb_agg(to_jsonb(t)) from services t where business_id = p_business_id),
    'addons',       (select jsonb_agg(to_jsonb(t)) from service_addons t where business_id = p_business_id),
    'clients',      (select jsonb_agg(to_jsonb(t)) from clients t where business_id = p_business_id),
    'appointments', (select jsonb_agg(to_jsonb(t)) from appointments t where business_id = p_business_id),
    'items',        (select jsonb_agg(to_jsonb(t)) from appointment_items t
                      join appointments a on a.id = t.appointment_id where a.business_id = p_business_id),
    'payments',     (select jsonb_agg(to_jsonb(t)) from payments t where business_id = p_business_id),
    'expenses',     (select jsonb_agg(to_jsonb(t)) from expenses t where business_id = p_business_id),
    'rates',        (select jsonb_agg(to_jsonb(t)) from exchange_rates t where business_id = p_business_id),
    'schedule',     (select jsonb_agg(to_jsonb(t)) from schedule_rules t where business_id = p_business_id),
    'photos',       (select jsonb_agg(to_jsonb(t)) from gallery_photos t where business_id = p_business_id));
end $function$;

revoke execute on function public.exportar_respaldo(uuid) from public, anon;
grant  execute on function public.exportar_respaldo(uuid) to authenticated;

-- 2. cancelar_cita: una clienta no puede hacerse pasar por el negocio (p_por = 'PROFESIONAL')
--    para saltarse el plazo mínimo de cancelación.
create or replace function public.cancelar_cita(p_token text, p_motivo text default null::text, p_por tipo_actor default 'CLIENTA'::tipo_actor)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare a appointments%rowtype; s settings%rowtype; b businesses%rowtype; v_horas numeric;
begin
  select * into a from appointments where access_token = p_token;
  if not found then raise exception 'CITA_NO_ENCONTRADA'; end if;
  if p_por <> 'CLIENTA' and not es_profesional(a.business_id) then raise exception 'NO_AUTORIZADA'; end if;
  if a.status not in ('PENDIENTE','CONFIRMADA') then raise exception 'CITA_NO_CANCELABLE'; end if;
  select * into s from settings where business_id = a.business_id;
  select * into b from businesses where id = a.business_id;

  v_horas := extract(epoch from (a.starts_at - now())) / 3600.0;
  if p_por = 'CLIENTA' and v_horas < s.cancel_blocked_hours then
    raise exception 'FUERA_DE_PLAZO';
  end if;

  update appointments set
    status = case when p_por = 'CLIENTA' then 'CANCELADA_CLIENTA'::estado_cita
                  else 'CANCELADA_NEGOCIO'::estado_cita end,
    cancelled_at = now(), cancelled_by = p_por, cancellation_reason = p_motivo, updated_at = now()
  where id = a.id;

  update notifications set status = 'OMITIDA'
   where appointment_id = a.id and status = 'PENDIENTE' and template_key like 'recordatorio%';

  insert into notifications (business_id, appointment_id, recipient_type, recipient_phone,
    template_key, rendered_message, scheduled_for)
  select a.business_id, a.id, 'PROFESIONAL', b.phone_whatsapp, 'hueco_liberado',
    format('Se libero el %s a las %s', to_char(a.starts_at at time zone b.timezone,'DD/MM'),
           to_char(a.starts_at at time zone b.timezone,'HH12:MI AM')), now();

  insert into audit_log (business_id, actor_type, action, entity_type, entity_id, before, after)
  values (a.business_id, p_por, 'cita.cancelada', 'appointment', a.id,
          jsonb_build_object('estado', a.status), jsonb_build_object('motivo', p_motivo));

  return jsonb_build_object('ok', true, 'horas_de_antelacion', round(v_horas,1),
    'anticipo_reembolsable', v_horas >= s.cancel_free_hours);
end $function$;

-- 3. Fijar search_path en funciones que no lo tenían (buena práctica en funciones security definer)
alter function public.es_profesional(uuid) set search_path to 'public';
alter function public.mi_client_id(uuid) set search_path to 'public';
