-- La web de reservas necesita saber la antelación mínima (Panel → Políticas → «Reservar con al menos»)
-- para explicar a la clienta por qué un día cercano no tiene turnos y ofrecerle WhatsApp.
-- Solo añade «reservar_minimo_horas» a lo que ya devuelve obtener_politicas (es una lectura).
-- No toca citas, clientas, servicios, precios ni horarios. Mantiene los permisos que ya tenía.
-- Ejecutar una vez en Supabase → SQL Editor; si algo falla, no se aplica nada.

begin;

create or replace function public.obtener_politicas(p_business_id uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'cancelar_minimo_horas', s.cancel_blocked_hours,
    'cancelar_gratis_horas', s.cancel_free_hours,
    'cambiar_minimo_horas',  s.reschedule_min_hours,
    'max_cambios',           s.max_reschedules,
    'max_citas_activas',     s.max_active_appointments_per_phone,
    'max_dias_antelacion',   s.max_advance_days,
    'reservar_minimo_horas', s.min_advance_hours,
    'anticipo',              s.deposit_enabled,
    'secciones',             s.policy_sections,
    'textos', jsonb_build_object(
      'cancelacion', s.policy_cancellation, 'cambios',    s.policy_reschedule,
      'anticipo',    s.policy_deposit,      'no_show',    s.policy_no_show,
      'retrasos',    s.policy_late,         'reembolsos', s.policy_refund,
      'espera',      s.policy_waiting,      'privacidad', s.privacy_notice))
  from settings s where s.business_id = p_business_id
$function$;

commit;

-- Comprobación: debe salir 24 (o las horas que tenga puestas Lynn)
select public.obtener_politicas('1a115b41-0000-4000-8000-000000000001') ->> 'reservar_minimo_horas' as reservar_minimo_horas;
