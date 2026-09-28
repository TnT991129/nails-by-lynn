-- Restaura los 5 servicios de Nails by Lynn si se ocultaron o se borraron desde el panel.
-- Ejecutar en Supabase → SQL Editor solo si en Panel → Servicios no aparecen o salen "Oculto".
-- Precios y duraciones: los que tenían el 25/09/2026. Luego se pueden ajustar desde el panel.

-- 1. Los que estén ocultos vuelven a estar visibles
update services set is_active = true, updated_at = now()
 where business_id = '1a115b41-0000-4000-8000-000000000001'
   and slug in ('polygel', 'base-rubber', 'builder-gel', 'soft-gel', 'pedicura')
   and not is_active;

-- 2. Los que se borraron se vuelven a crear
insert into services (business_id, name, slug, duration_minutes, buffer_after_minutes, price, currency, is_active, sort_order)
select '1a115b41-0000-4000-8000-000000000001', v.nombre, v.slug, v.minutos, 10, v.precio, 'CUP', true, v.orden
from (values
  ('Polygel',     'polygel',     120, 3500, 10),
  ('Base Rubber', 'base-rubber',  75, 4000, 20),
  ('Builder Gel', 'builder-gel',  90, 4500, 30),
  ('Soft Gel',    'soft-gel',     90, 4000, 40),
  ('Pedicura',    'pedicura',     60, 3000, 50)
) as v(nombre, slug, minutos, precio, orden)
where not exists (
  select 1 from services s
   where s.business_id = '1a115b41-0000-4000-8000-000000000001' and s.slug = v.slug);

-- Comprobación: deben salir los 5 activos
select name, price, duration_minutes, is_active from services
 where business_id = '1a115b41-0000-4000-8000-000000000001' order by sort_order;
