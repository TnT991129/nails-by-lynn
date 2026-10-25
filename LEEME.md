# Nails by Lynn — Aplicación web

React + TypeScript + Vite + Tailwind. Datos en Supabase (PostgreSQL).
Sin backend propio: la lógica vive en funciones de PostgreSQL.

## Poner en marcha

```bash
npm install
cp .env.example .env.local     # y pon tus valores reales
npm run dev
```

Abre http://localhost:5173

## Variables de entorno

`.env.local` (NUNCA se sube al repositorio, ya está en .gitignore):

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_KEY=sb_publishable_...
```

Usa solo la clave publicable o anon. La `service_role` jamás va aquí.

## Publicar en GitHub Pages

1. Crea el repositorio en GitHub con el nombre `nails-by-lynn`.
2. En el repo: Settings → Secrets and variables → Actions → New repository secret.
   Crea `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY` con tus valores.
3. Settings → Pages → Source: **GitHub Actions**.
4. `git push` a `main`. El despliegue tarda ~90 segundos.

Queda en `https://TU-USUARIO.github.io/nails-by-lynn/`

Si cambias el nombre del repositorio, actualiza `base` en `vite.config.ts`
y `start_url` en `public/manifest.json`.

## Estructura

```
src/
  lib/
    supabase.ts       Cliente HTTP mínimo contra PostgREST
    api.ts            Funciones tipadas (servicios, disponibilidad, citas)
    tipos.ts          Tipos compartidos
    formato.ts        Fechas, horas y dinero en hora de Cuba
    almacenamiento.ts Tokens de cita en el dispositivo
    errores.ts        Traduce errores de PostgreSQL a lenguaje de marca
  componentes/
    ui.tsx            Boton, Tarjeta, Campo, Pildora, Esqueleto, Vacio, Aviso
    Navegacion.tsx    Barra inferior
  caracteristicas/reserva/
    useReserva.ts     Estado del flujo de 5 pasos
    Pasos.tsx         Los cinco pasos
    validacion.ts     Nombre, teléfono cubano, correo
  paginas/
    Inicio.tsx  Servicios.tsx  Reserva.tsx  Cita.tsx  MisCitas.tsx
```

## Decisiones que conviene conocer

**No usamos `@supabase/supabase-js`.** Pesa 58 KB comprimidos y el sitio público
solo necesita lecturas y llamadas RPC. `lib/supabase.ts` hace eso con `fetch` en
40 líneas. La carga inicial bajó de 134 KB a 72 KB comprimidos. Cuando hagamos el
panel de Lynn, ese sí cargará la librería completa, pero solo en su ruta.

**Duración y precio se calculan dos veces.** En el navegador solo para mostrarlos.
Al confirmar, `crear_cita` los recalcula desde la base de datos. Si alguien
manipula el JavaScript, el precio real no cambia.

**Las horas ocupadas no se muestran**, no se muestran en gris. Solo aparece lo reservable.

**Sin cuentas de clienta.** El token de cada cita se guarda en el dispositivo y
"Mis citas" los lee. El enlace del WhatsApp funciona desde cualquier teléfono.

**El panel (`/panel`) sí usa `@supabase/supabase-js`**, cargado aparte solo en esa ruta.

## Base de datos (carpeta `supabase/`)

Cada archivo `.sql` es una migración que se ejecuta **una vez** en Supabase → SQL Editor,
en este orden:

1. `turnos_fijos.sql`, `eliminar_clienta.sql`, `seguridad.sql`
2. `politicas_y_espera.sql`, `reprogramar_clienta.sql`
3. `turnos_descuentos_cambios.sql`, `correcciones_revision.sql`
4. `rango_complementos.sql`, `tasa_dolar.sql`
5. `agenda_complementos.sql`, `complementos_y_descuentos.sql`
6. `mejoras.sql`, `rango_en_citas.sql`, `editar_cita.sql`
7. `revision_seguridad_octubre.sql` (incluye lo de `mejoras.sql`; no ejecutes `mejoras.sql`
   después de `rango_en_citas.sql`, porque instala una versión anterior de `obtener_cita_por_token`)
8. `panel_editar_y_politicas.sql`
9. `textos_web.sql`
10. `fotos_permisos.sql`
11. `notificaciones_push.sql` (y la Edge Function de abajo)

### Avisos al móvil de las clientas (Web Push)

1. Supabase → Edge Functions → *Deploy a new function* → *Via editor*. Nombre: `enviar-push`.
   Pega `supabase/functions/enviar-push/index.ts` y despliega.
2. En los ajustes de esa función, desactiva **Enforce JWT verification** (la llama la base de datos;
   solo envía lo que ya está en la cola, así que no se puede abusar de ella).
3. Edge Functions → Secrets: crea `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` con los valores de
   `supabase/.env.push.local` (ese archivo no se sube a GitHub; si se pierde, se generan claves nuevas
   y se cambia también la pública en `src/lib/push.ts`).
4. Ejecuta `notificaciones_push.sql`.

La clienta activa los avisos con el botón «Activar avisos» de la página de su cita. En el iPhone
solo funcionan con la web añadida a la pantalla de inicio (iOS 16.4 o más).

Los textos de la web de las clientas están en `src/lib/textos.ts` (texto por defecto de cada uno);
Lynn los cambia en Panel → Más → Textos de la web.

`restaurar_servicios.sql` solo se usa si se borran los servicios por error.
**`esquema.sql` no se ejecuta**: es una copia de referencia antigua.

En Supabase → Authentication → Sign In / Providers conviene tener **desactivado
«Allow new users to sign up»**: la única cuenta debe ser la de Lynn.
