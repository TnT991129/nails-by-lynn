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

Antes de publicar: `npm run lint` (revisión automática del código) y `npm test` (pruebas de los cálculos:
lo cobrado en Estadísticas, la tarjeta de fidelidad, fechas en hora de Cuba, teléfonos, el diseño guardado).
El despliegue pasa las dos y se detiene si algo falla. Las pruebas son los archivos `*.test.ts`.

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
    diseno.ts         Diseño de la web que elige Lynn (colores, fuentes, secciones)
    panel/
      api-panel.ts    Índice: las pantallas del panel importan de aquí
      api/            Funciones del panel por áreas: agenda, clientas, negocio (servicios, horarios,
                      políticas, respaldo), dinero (estadísticas, gastos, cobros), web (galería, textos,
                      diseño, opiniones) y ganado.ts (lo cobrado de cada cita, sin Supabase)
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

**Fuentes dentro de la web.** Playfair Display (Elegante, la de siempre), Dancing Script (Manuscrita) y
Nunito (Redondeada) vienen en `@fontsource-variable/*` (importadas en `main.tsx`): antes dependían de que el
móvil las tuviera y en Android salía otra. Unos 40 KB cada una; el navegador solo baja la que usa el diseño
elegido y el service worker la guarda para las siguientes visitas.

**Animaciones sin librerías.** Todo el movimiento es CSS + `IntersectionObserver` (unos 2 KB).
Si el móvil tiene activado «reducir movimiento» o es muy antiguo, la web se ve quieta y completa.
Los botones con degradado terminan en `vino` (#A80E52), un tono fijo para que el texto blanco se lea
también en modo oscuro.

## Base de datos (carpeta `supabase/`)

- **`esquema.sql`**: cómo está la base de datos ahora (tablas, funciones, permisos, políticas, tareas).
  Es la referencia; **no se ejecuta** sobre la base de datos en uso.
- **`historial/`**: las migraciones que la fueron construyendo. Ya están aplicadas; no se repiten.
- **`restaurar_servicios.sql`**: solo si se borran los servicios por error.

**Pendientes de ejecutar** (cada uno una vez, en Supabase → SQL Editor; después se mueven a `historial/`):

- `recomendaciones_y_bonos.sql`: **recomendaciones** (la clienta comparte su enlace; cuando la amiga completa su
  primera cita, las dos tienen un descuento) y **bonos regalo** (Lynn los vende y se canjean en «Cobrar»; la base de
  datos impide gastar más del saldo). Añade `clients.referred_by`, `clients.referral_rewarded_at`,
  `payments.gift_card_id` y la tabla `gift_cards`; incluye los bonos en el respaldo. Sin él, la web y el panel
  funcionan igual y esas dos pantallas avisan de que falta.

Los anteriores (`antelacion_en_politicas.sql`, `inspiracion_fidelidad_visitas.sql` y `fidelidad_niveles.sql`) ya
están aplicados y en `historial/`; `esquema.sql` aún no los incluye: conviene volver a sacarlo (paso 3 de abajo).

**Lo que se ganó = lo cobrado.** El precio de los servicios es una estimación: Lynn cobra al final según el
largo, el diseño… En Estadísticas, Hoy y la ficha de la clienta, una cita completada cuenta lo apuntado en
«Cobrar» (tabla `payments`); si no se apuntó nada, su precio estimado (`total_amount`). Ver `ganadoCita` en
`src/lib/panel/api-panel.ts`. En «Servicios más vendidos», lo cobrado se reparte entre los servicios de la cita
según lo que pesa cada uno en el precio.

**Ajustes guardados junto a los textos.** `settings.site_texts` guarda, además de los textos, ajustes de la web
en claves que empiezan por «_» (JSON): `_diseno` (Diseño de la web), `_fidelidad` (Tarjeta de fidelidad) y `_recomendaciones` (Recomendaciones).
Textos de la web las conserva al guardar.

**Para cambiar algo en la base de datos:**

1. Escribe un archivo nuevo en `supabase/` con el cambio (entre `begin;` y `commit;`, para que si
   falla no se aplique nada) y ejecútalo una vez en Supabase → SQL Editor.
2. Muévelo a `supabase/historial/`.
3. Vuelve a sacar el esquema: ejecuta `exportar_esquema.sql` (solo lee) → Export → Download CSV, y
   `python supabase/csv_a_esquema.py "ruta/al/archivo.csv"`.

### Avisos al móvil de Lynn (Web Push)

Le llegan a Lynn cuando una clienta reserva, cancela, cambia la fecha o los servicios, se apunta a la
lista de espera o deja una opinión. Lo que hace ella desde el panel no le avisa.

1. Supabase → Edge Functions → *Deploy a new function* → *Via editor*. Pega
   `supabase/functions/enviar-push/index.ts` y despliega. **Está publicada con el nombre `super-handler`**
   (el que puso Supabase por defecto): la base de datos llama a `/functions/v1/super-handler`
   (`despertar_envio_push`). Si se vuelve a crear con otro nombre, hay que cambiar también esa URL.
2. En los ajustes de esa función, desactiva **Enforce JWT verification** (la llama la base de datos;
   solo envía lo que ya está en la cola, así que no se puede abusar de ella).
3. Edge Functions → Secrets: crea `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` con los valores de
   `supabase/.env.push.local` (ese archivo no se sube a GitHub; si se pierde, se generan claves nuevas
   y se cambia también la pública en `src/lib/panel/avisos.ts`).
4. Ya ejecutado: `historial/avisos_lynn.sql`.

**Clave de los avisos** (activa desde el 28/10/2026). La función solo atiende llamadas `POST` que traigan
la cabecera `x-avisos-secreto` con la clave; las demás reciben 401 (o 405 si no son `POST`).

- La base de datos la manda sola (`despertar_envio_push`, ver `historial/seguridad_avisos_y_diagnostico.sql`);
  la clave vive en Vault: `select decrypted_secret from vault.decrypted_secrets where name = 'avisos_push_secreto';`
- La función la lee del secreto `AVISOS_SECRETO` (Edge Functions → Secrets). Los dos valores deben coincidir.
- Comprobar: `select public.despertar_envio_push();` y, unos segundos después,
  `select status_code, content::text from net._http_response order by created desc limit 1;` → 200.
- Si algo falla, borra el secreto `AVISOS_SECRETO` y la función vuelve a aceptar las llamadas sin clave.

Lynn los activa, y elige cuáles quiere, en Panel → Más → «Avisos en este móvil». En el iPhone solo
funcionan con el panel añadido a la pantalla de inicio (iOS 16.4 o más).

Los textos de la web de las clientas están en `src/lib/textos.ts` (texto por defecto de cada uno);
Lynn los cambia en Panel → Más → Textos de la web.


### Copia de seguridad automática

El plan gratis de Supabase no guarda copias: si se borra algo, no hay vuelta atrás. La tarea
`.github/workflows/respaldo.yml` descarga la base de datos entera cada domingo, la **cifra** (el repositorio
puede ser público y ahí están los teléfonos de las clientas) y la guarda 90 días.

Para activarla, en GitHub → Settings → Secrets and variables → Actions crea dos secretos:

- `SUPABASE_DB_URL`: Supabase → botón **Connect** → *Session pooler* (no la «Direct», que GitHub no alcanza).
  Es algo como `postgresql://postgres.wxkywplcbfrldnoajirn:CONTRASEÑA@aws-0-….pooler.supabase.com:5432/postgres`.
- `RESPALDO_CLAVE`: una contraseña larga inventada. **Guárdala fuera del ordenador**: sin ella la copia no se abre.

Probarla: Actions → «Copia de seguridad de la base de datos» → *Run workflow*. Sin los secretos, la tarea no hace
nada y no da error. Para abrir una copia: descarga el artifact, descomprime el .zip y
`gpg -d respaldo-AAAA-MM-DD.tar.gz.gpg | tar xz` (pide la clave). Dentro van `esquema.sql` y `datos.sql`.

En Supabase → Authentication → Sign In / Providers conviene tener **desactivado
«Allow new users to sign up»**: la única cuenta debe ser la de Lynn.
