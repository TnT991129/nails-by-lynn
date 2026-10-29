-- Tarjeta de fidelidad con varios premios y ajustes por clienta.
-- Solo AÑADE dos columnas a las clientas (con valores por defecto que no cambian nada) y redefine las dos
-- funciones de la tarjeta. No toca citas, servicios, precios ni horarios.
-- Sirve se haya ejecutado o no inspiracion_fidelidad_visitas.sql. Ejecutar una vez en Supabase → SQL Editor;
-- va entre begin/commit: si algo falla, no se aplica nada.
--
-- Configuración (Panel → Más → Tarjeta de fidelidad), en settings.site_texts → «_fidelidad»:
--   {"activa": true, "repetir": true, "niveles": [{"citas": 5, "premio": 15}, {"citas": 10, "premio": 20}]}
-- Sellos de una clienta = citas completadas + loyalty_adjustment (lo que Lynn sume o quite en su ficha).

begin;

alter table public.clients add column if not exists loyalty_adjustment integer not null default 0;
alter table public.clients add column if not exists loyalty_excluded boolean not null default false;

-- Lo que ve la clienta: sus sellos y si tiene un premio esperando
create or replace function public.tarjeta_fidelidad(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('completadas', greatest(c.total_appointments + c.loyalty_adjustment, 0),
                            'fuera', c.loyalty_excluded,
                            'descuento_pendiente', c.next_discount_percent)
    from appointments a join clients c on c.id = a.client_id
   where a.access_token = p_token
$$;
revoke all on function public.tarjeta_fidelidad(text) from public;
grant execute on function public.tarjeta_fidelidad(text) to anon, authenticated;

-- Al completar una cita: si con ese sello llega a un premio, se le deja para la próxima cita.
-- Cualquier fallo aquí se ignora: completar una cita nunca puede fallar por la tarjeta.
create or replace function public.tg_premio_fidelidad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare cfg jsonb; v_niveles jsonb; v_repetir boolean; v_tamano int; v_sellos int; v_fuera boolean;
        v_pos int; v_premio numeric;
begin
  if new.status <> 'COMPLETADA' or old.status = 'COMPLETADA' then return null; end if;
  begin
    select (site_texts ->> '_fidelidad')::jsonb into cfg from settings where business_id = new.business_id;
    if cfg is null or coalesce((cfg ->> 'activa')::boolean, false) is false then return null; end if;
    v_repetir := coalesce((cfg ->> 'repetir')::boolean, true);
    v_niveles := cfg -> 'niveles';
    -- Versión anterior de la tarjeta: un solo premio
    if v_niveles is null or jsonb_typeof(v_niveles) <> 'array' or jsonb_array_length(v_niveles) = 0 then
      v_niveles := jsonb_build_array(jsonb_build_object('citas', cfg -> 'sellos', 'premio', cfg -> 'premio'));
    end if;
    select max((n ->> 'citas')::int) into v_tamano from jsonb_array_elements(v_niveles) n;
    if v_tamano is null or v_tamano < 1 then return null; end if;

    select greatest(total_appointments + loyalty_adjustment, 0), loyalty_excluded into v_sellos, v_fuera
      from clients where id = new.client_id;
    if v_fuera or v_sellos < 1 then return null; end if;
    if not v_repetir and v_sellos > v_tamano then return null; end if;
    v_pos := case when v_repetir then ((v_sellos - 1) % v_tamano) + 1 else v_sellos end;

    select max((n ->> 'premio')::numeric) into v_premio
      from jsonb_array_elements(v_niveles) n where (n ->> 'citas')::int = v_pos;
    if v_premio is not null and v_premio > 0 and v_premio <= 100 then
      update clients
         set next_discount_percent = greatest(coalesce(next_discount_percent, 0), v_premio),
             next_discount_note = 'Premio de la tarjeta de fidelidad', next_discount_at = now()
       where id = new.client_id;
    end if;
  exception when others then
    raise warning 'tg_premio_fidelidad: %', sqlerrm;
  end;
  return null;
end $$;
revoke all on function public.tg_premio_fidelidad() from public, anon, authenticated;
-- El nombre empieza por «tg_p…»: va después de t_contadores (que suma la cita) en el orden alfabético
drop trigger if exists tg_premio_fidelidad on public.appointments;
create trigger tg_premio_fidelidad after update of status on public.appointments
  for each row execute function public.tg_premio_fidelidad();

commit;

-- Comprobación: columnas = 2 y trigger = true
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'clients'
          and column_name in ('loyalty_adjustment', 'loyalty_excluded')) as columnas,
       exists (select 1 from pg_trigger where tgname = 'tg_premio_fidelidad') as trigger;
