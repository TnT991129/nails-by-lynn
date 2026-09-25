import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Inicio from './paginas/Inicio'
import Navegacion from './componentes/Navegacion'
import LimiteErrores, { recargarPorVersionNueva } from './componentes/LimiteErrores'

// Páginas públicas: se descargan en segundo plano tras abrir la web para que funcionen sin conexión
const PAGINAS_PUBLICAS = {
  reserva:  () => import('./paginas/Reserva'),
  cita:     () => import('./paginas/Cita'),
  misCitas: () => import('./paginas/MisCitas'),
  galeria:  () => import('./paginas/Galeria'),
}

const Servicios = lazy(() => import('./paginas/Servicios'))
const Reserva   = lazy(PAGINAS_PUBLICAS.reserva)
const Cita      = lazy(PAGINAS_PUBLICAS.cita)
const MisCitas  = lazy(PAGINAS_PUBLICAS.misCitas)
const Panel     = lazy(() => import('./paginas/panel'))
const Galeria   = lazy(PAGINAS_PUBLICAS.galeria)
const Politicas = lazy(() => import('./paginas/Politicas'))

function Cargando() {
  return (
    <div className="p-5 space-y-3">
      <div className="h-6 w-40 bg-rosa-100 rounded animate-pulso" />
      <div className="h-28 bg-rosa-100 rounded animate-pulso" />
      <div className="h-28 bg-rosa-100 rounded animate-pulso" />
    </div>
  )
}
import './index.css'

// Service worker: carga instantánea en visitas repetidas y funcionamiento sin conexión.
// Solo en producción, para no interferir con el servidor de desarrollo.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(e => console.warn('No se pudo registrar el service worker:', e))
    // Respeta el modo "ahorro de datos" del móvil
    const conexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (!conexion?.saveData) {
      setTimeout(() => Object.values(PAGINAS_PUBLICAS).forEach(cargar => cargar().catch(() => {})), 3000)
    }
  })
}

// Vite avisa cuando no puede cargar un trozo de la app (típico tras publicar una versión nueva)
window.addEventListener('vite:preloadError', e => {
  if (recargarPorVersionNueva()) e.preventDefault()
})

function Rutas() {
  const { pathname } = useLocation()
  return (
    <LimiteErrores ruta={pathname}>
      <Suspense fallback={<Cargando />}>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/servicios" element={<Servicios />} />
          <Route path="/reservar" element={<Reserva />} />
          <Route path="/cita/:token" element={<Cita />} />
          <Route path="/mis-citas" element={<MisCitas />} />
          <Route path="/galeria" element={<Galeria />} />
          <Route path="/politicas" element={<Politicas />} />
          <Route path="/panel/*" element={<Panel />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </LimiteErrores>
  )
}

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: a => Math.min(1000 * 2 ** a, 8000),
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Rutas />
        <Navegacion />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
