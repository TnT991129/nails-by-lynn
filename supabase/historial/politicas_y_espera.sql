-- Políticas visibles para las clientas y lista de espera.
-- Ejecutar una vez en Supabase → SQL Editor.

-- 1. obtener_politicas: devuelve SOLO las reglas y textos de políticas (settings es privada).
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
    'textos', jsonb_build_object(
      'cancelacion', s.policy_cancellation, 'cambios',    s.policy_reschedule,
      'anticipo',    s.policy_deposit,      'no_show',    s.policy_no_show,
      'retrasos',    s.policy_late,         'reembolsos', s.policy_refund,
      'espera',      s.policy_waiting,      'privacidad', s.privacy_notice))
  from settings s where s.business_id = p_business_id
$$;

grant execute on function public.obtener_politicas(uuid) to anon, authenticated;

-- 2. unirse_lista_espera: la clienta pide que la avisen si se libera un turno ese día.
--    Crea la clienta por teléfono si no existe (igual que crear_cita). Máximo 3 días en espera por teléfono.
create or replace function public.unirse_lista_espera(
  p_business_id uuid, p_fecha date, p_nombre text, p_telefono text, p_service_id uuid default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare b businesses%rowtype; s settings%rowtype; v_tel text; v_client clients%rowtype;
        v_hoy date; v_activas int;
begin
  select * into b from businesses where id = p_business_id;
  if not found then raise exception 'NEGOCIO_NO_EXISTE'; end if;
  select * into s from settings where business_id = p_business_id;

  v_hoy := (now() at time zone b.timezone)::date;
  if p_fecha < v_hoy or p_fecha > v_hoy + s.max_advance_days then raise exception 'FECHA_NO_VALIDA'; end if;
  if length(trim(coalesce(p_nombre, ''))) < 2 then raise exception 'NOMBRE_INVALIDO'; end if;

  v_tel := normalizar_telefono(p_telefono);
  if v_tel is null or length(regexp_replace(v_tel, '\D', '', 'g')) < 10 then raise exception 'TELEFONO_INVALIDO'; end if;

  select * into v_client from clients where business_id = p_business_id and phone = v_tel;
  if not found then
    insert into clients (business_id, full_name, phone) values (p_business_id, trim(p_nombre), v_tel)
    returning * into v_client;
  elsif v_client.is_blocked then
    raise exception 'CLIENTA_BLOQUEADA';
  end if;

  -- Ya estaba apuntada ese día: no se duplica
  if exists (select 1 from waitlist where client_id = v_client.id and preferred_date_from = p_fecha
                                       and status = 'ACTIVA') then
    return jsonb_build_object('ok', true, 'ya_estaba', true);
  end if;

  select count(*) into v_activas from waitlist
   where client_id = v_client.id and status = 'ACTIVA' and preferred_date_from >= v_hoy;
  if v_activas >= 3 then raise exception 'LIMITE_LISTA_ESPERA'; end if;

  insert into waitlist (business_id, client_id, service_id, preferred_date_from, preferred_date_to, status)
  values (p_business_id, v_client.id, p_service_id, p_fecha, p_fecha, 'ACTIVA');

  return jsonb_build_object('ok', true, 'ya_estaba', false);
end $function$;

grant execute on function public.unirse_lista_espera(uuid, date, text, text, uuid) to anon, authenticated;
