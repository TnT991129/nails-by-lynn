import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useSesion } from '../../lib/panel/useSesion'
import { Esqueleto } from '../../componentes/ui'

const Entrar = lazy(() => import('./Entrar'))
const Marco = lazy(() => import('./Marco'))
const Hoy = lazy(() => import('./Hoy'))
const Agenda = lazy(() => import('./Agenda'))
const CitaManual = lazy(() => import('./CitaManual'))
const DetalleCita = lazy(() => import('./DetalleCita'))
const Clientas = lazy(() => import('./Clientas'))
const FichaClienta = lazy(() => import('./FichaClienta'))
const Mas = lazy(() => import('./Mas'))
const EditarServicios = lazy(() => import('./EditarServicios'))
const EditarHorarios = lazy(() => import('./EditarHorarios'))
const Estadisticas = lazy(() => import('./Estadisticas'))
const Gastos = lazy(() => import('./Gastos'))

function Cargando() {
  return <div className="p-5"><Esqueleto className="h-24" /></div>
}

export default function Panel() {
  const { estado } = useSesion()

  if (estado === 'cargando') return <Cargando />

  return (
    <Suspense fallback={<Cargando />}>
      <Routes>
        <Route path="entrar" element={
          estado === 'con-sesion' ? <Navigate to="/panel" replace /> : <Entrar />
        } />
        {estado === 'con-sesion' ? (
          <Route path="/" element={<Marco />}>
            <Route index element={<Hoy />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="agenda/nueva" element={<CitaManual />} />
            <Route path="cita/:id" element={<DetalleCita />} />
            <Route path="clientas" element={<Clientas />} />
            <Route path="clientas/:id" element={<FichaClienta />} />
            <Route path="mas" element={<Mas />} />
            <Route path="servicios" element={<EditarServicios />} />
            <Route path="horarios" element={<EditarHorarios />} />
            <Route path="estadisticas" element={<Estadisticas />} />
            <Route path="gastos" element={<Gastos />} />
          </Route>
        ) : (
          <Route path="*" element={<Navigate to="/panel/entrar" replace />} />
        )}
      </Routes>
    </Suspense>
  )
}
