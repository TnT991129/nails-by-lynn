-- Complementos con rango de precio (p. ej. 2 – 4). Ejecutar una vez en Supabase → SQL Editor.
-- extra_price     = precio "desde" (el que se suma al reservar)
-- extra_price_max = precio "hasta" (opcional; vacío = precio fijo)
alter table service_addons add column if not exists extra_price_max numeric(12,2);
alter table service_addons drop constraint if exists addons_rango_valido;
alter table service_addons add constraint addons_rango_valido
  check (extra_price_max is null or extra_price_max >= extra_price);
