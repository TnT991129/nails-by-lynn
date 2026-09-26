import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  IconoGrafico, IconoGaleria, IconoBillete, IconoDestellos, IconoCalendario, IconoReloj, IconoDescarga,
} from '../../componentes/iconos'

const ITEMS: { a: string; titulo: string; desc: string; icono: ReactNode }[] = [
  { a: '/panel/estadisticas', titulo: 'Estadísticas',    desc: 'Ingresos, neto, clientas top',       icono: <IconoGrafico /> },
  { a: '/panel/galeria',      titulo: 'Galería',         desc: 'Subir y publicar fotos',             icono: <IconoGaleria /> },
  { a: '/panel/gastos',       titulo: 'Gastos',          desc: 'Material, transporte, marketing',    icono: <IconoBillete /> },
  { a: '/panel/servicios',    titulo: 'Servicios',       desc: 'Precios, fotos y complementos',      icono: <IconoDestellos /> },
  { a: '/panel/horarios',     titulo: 'Horarios',        desc: 'Semana, vacaciones y bloqueos',      icono: <IconoCalendario /> },
  { a: '/panel/espera',       titulo: 'Lista de espera', desc: 'Clientas esperando un turno libre',  icono: <IconoReloj /> },
  { a: '/panel/respaldo',     titulo: 'Respaldo',        desc: 'Descargar copia de tus datos',       icono: <IconoDescarga /> },
]

export default function Mas() {
  return (
    <div className="p-5 space-y-3">
      <h1 className="text-[30px] leading-tight mb-1">Más</h1>
      <div className="bg-white rounded-xl border border-rosa-100/80 shadow-suave divide-y divide-rosa-100 overflow-hidden">
        {ITEMS.map(i => (
          <Link key={i.a} to={i.a} className="flex items-center gap-3 px-4 py-3.5 min-h-[64px] active:bg-rosa-50 transition-colors">
            <span className="w-10 h-10 rounded-full bg-rosa-50 text-rosa-600 flex items-center justify-center shrink-0">
              {i.icono}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-medium">{i.titulo}</div>
              <div className="text-[13px] text-tinta-tenue truncate">{i.desc}</div>
            </div>
            <span className="text-rosa-400 text-[22px] leading-none" aria-hidden>›</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
