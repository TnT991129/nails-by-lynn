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

## Lo que falta

- Galería y portafolio
- Panel de Lynn (agenda, clientas, servicios, horarios, estadísticas)
- Reprogramar desde la pantalla de cita (la función `reprogramarCita` ya existe)
- Foto para el hero y para las tarjetas de servicio
- Service worker de la PWA
