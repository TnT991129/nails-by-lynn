import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Inicio from './paginas/Inicio'
import Navegacion from './componentes/Navegacion'
import LimiteErrores, { recargarPorVersionNueva } from './componentes/LimiteErrores'

const Servicios = lazy(() => import('./paginas/Servicios'))
const Reserva   = lazy(() => import('./paginas/Reserva'))
const Cita      = lazy(() => import('./paginas/Cita'))
const MisCitas  = lazy(() => import('./paginas/MisCitas'))
const Panel     = lazy(() => import('./paginas/panel'))
const Galeria   = lazy(() => import('./paginas/Galeria'))

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
