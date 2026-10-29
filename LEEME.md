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

Antes de publicar: `npm run lint` (revisión automática del código; el despliegue también la pasa y se
detiene si hay errores).

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
    Movimiento.tsx    Animaciones: Revelar (aparece al hacer scroll), paralaje, contador, confeti
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

**Animaciones sin librerías.** Todo el movimiento es CSS + `IntersectionObserver` (unos 2 KB).
Si el móvil tiene activado «reducir movimiento» o es muy antiguo, la web se ve quieta y completa.
Los botones con degradado terminan en `vino` (#A80E52), un tono fijo para que el texto blanco se lea
también en modo oscuro.

## Base de datos (carpeta `supabase/`)

- **`esquema.sql`**: cómo está la base de datos ahora (tablas, funciones, permisos, políticas, tareas).
  Es la referencia; **no se ejecuta** sobre la base de datos en uso.
- **`historial/`**: las migraciones que la fueron construyendo. Ya están aplicadas; no se repiten.
- **`restaurar_servicios.sql`**: solo si se borran los servicios por error.

**Para cambiar algo en la base de datos:**

1. Escribe un archivo nuevo en `supabase/` con el cambio (entre `begin;` y `commit;`, para que si
   falla no se aplique nada) y ejecútalo una vez en Supabase → SQL Editor.
2. Muévelo a `supabase/historial/`.
3. Vuelve a sacar el esquema: ejecuta `exportar_esquema.sql` (solo lee) → Export → Download CSV, y
   `python supabase/csv_a_esquema.py "ruta/al/archivo.csv"`.

### Avisos al móvil de Lynn (Web Push)

Le llegan a Lynn cuando una clienta reserva, cancela, cambia la fecha o los servicios, se apunta a la
lista de espera o deja una opinión. Lo que hace ella desde el panel no le avisa.

1. Supabase → Edge Functions → *Deploy a new function* → *Via editor*. Nombre: `enviar-push`.
   Pega `supabase/functions/enviar-push/index.ts` y despliega.
2. En los ajustes de esa función, desactiva **Enforce JWT verification** (la llama la base de datos;
   solo envía lo que ya está en la cola, así que no se puede abusar de ella).
3. Edge Functions → Secrets: crea `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` con los valores de
   `supabase/.env.push.local` (ese archivo no se sube a GitHub; si se pierde, se generan claves nuevas
   y se cambia también la pública en `src/lib/panel/avisos.ts`).
4. Ya ejecutado: `historial/avisos_lynn.sql`.

**Clave de los avisos** (para que nadie más pueda despertar la función). Hacerlo en este orden;
en cualquier punto intermedio los avisos siguen llegando:

1. Ya hecho (28/10/2026): `historial/seguridad_avisos_y_diagnostico.sql` (la base de datos manda la clave).
2. Copia la clave: `select decrypted_secret from vault.decrypted_secrets where name = 'avisos_push_secreto';`
3. Edge Functions → Secrets: crea `AVISOS_SECRETO` con ese valor.
4. Vuelve a desplegar `enviar-push` con el código actual de `supabase/functions/enviar-push/index.ts`.

Si algo falla, borra el secreto `AVISOS_SECRETO` y la función vuelve a aceptar las llamadas sin clave.

Lynn los activa, y elige cuáles quiere, en Panel → Más → «Avisos en este móvil». En el iPhone solo
funcionan con el panel añadido a la pantalla de inicio (iOS 16.4 o más).

Los textos de la web de las clientas están en `src/lib/textos.ts` (texto por defecto de cada uno);
Lynn los cambia en Panel → Más → Textos de la web.


En Supabase → Authentication → Sign In / Providers conviene tener **desactivado
«Allow new users to sign up»**: la única cuenta debe ser la de Lynn.
