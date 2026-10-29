-- Eliminar una clienta junto con todo su historial de citas (servicios, complementos, pagos y avisos).
-- Ejecutar una vez en Supabase → SQL Editor.
-- Solo la profesional puede usarla, y nunca borra a quien tiene citas por venir.

create or replace function public.eliminar_clienta_con_historial(p_client_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $$
declare v_negocio uuid; v_citas uuid[];
begin
  select business_id into v_negocio from clients where id = p_client_id;
  if not found then raise exception 'CLIENTA_NO_ENCONTRADA'; end if;
  if not es_profesional(v_negocio) then raise exception 'NO_AUTORIZADA'; end if;

  -- No borrar a quien tiene citas por venir
  if exists (select 1 from appointments
             where client_id = p_client_id
               and status in ('PENDIENTE','CONFIRMADA','EN_CURSO')
               and blocked_until > now()) then
    raise exception 'CLIENTA_CON_CITAS_ACTIVAS';
  end if;

  select coalesce(array_agg(id), '{}') into v_citas from appointments where client_id = p_client_id;

  delete from appointment_item_addons
   where appointment_item_id in (select id from appointment_items where appointment_id = any(v_citas));
  delete from appointment_items where appointment_id = any(v_citas);
  delete from payments          where appointment_id = any(v_citas);
  delete from notifications     where appointment_id = any(v_citas);
  delete from appointments      where id = any(v_citas);
  delete from clients           where id = p_client_id;

  return jsonb_build_object('citas_borradas', coalesce(array_length(v_citas, 1), 0));
end $$;

revoke execute on function public.eliminar_clienta_con_historial(uuid) from public, anon;
grant  execute on function public.eliminar_clienta_con_historial(uuid) to authenticated;
