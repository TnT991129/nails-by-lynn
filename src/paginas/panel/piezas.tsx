// Piezas con las que están hechas todas las pantallas del panel: cabecera, secciones, bloques plegables,
// pestañas, fila de cifras y la tarjeta de una cita. Así todas se ven y se ordenan igual.
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconoAtras, IconoAbajo } from '../../componentes/iconos'
import { Pildora } from '../../componentes/ui'
import { hora, duracion } from '../../lib/formato'
import type { CitaAgenda } from '../../lib/panel/api-panel'
import { ListaServicios } from './comunes'

/** Cabecera de pantalla: «volver» (en las pantallas de dentro), título, una línea de apoyo y una acción a la derecha */
export function Cabecera({ titulo, sobre, apoyo, accion, volver = false }: {
  titulo: string; sobre?: string; apoyo?: ReactNode; accion?: ReactNode; volver?: boolean
}) {
  const navegar = useNavigate()
  return (
    <header className="space-y-1">
      {volver && (
        <button onClick={() => navegar(-1)}
          className="-ml-2 mb-1 min-h-[40px] pl-1 pr-3 rounded-full inline-flex items-center gap-1 text-[14px] text-tinta-suave hover:bg-rosa-50">
          <IconoAtras tam={18} /> Volver
        </button>
      )}
      {sobre && <p className="text-[13px] text-tinta-tenue first-letter:uppercase">{sobre}</p>}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[28px] leading-tight min-w-0 break-words">{titulo}</h1>
        {accion && <div className="shrink-0">{accion}</div>}
      </div>
      {apoyo && <div className="text-[14px] text-tinta-tenue">{apoyo}</div>}
    </header>
  )
}

/** Grupo de contenido con su título pequeño encima */
export function Seccion({ titulo, extra, children, className = '' }: {
  titulo: string; extra?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={`space-y-2.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="!font-sans text-[12px] font-semibold tracking-[0.14em] uppercase text-tinta-tenue">{titulo}</h2>
        {extra && <div className="text-[13px] text-tinta-tenue">{extra}</div>}
      </div>
      {children}
    </section>
  )
}

/** Tarjeta que se abre y se cierra: lo que se usa de vez en cuando no ocupa la pantalla */
export function Plegable({ titulo, resumen, icono, abierto = false, children }: {
  titulo: string; resumen?: ReactNode; icono?: ReactNode; abierto?: boolean; children: ReactNode
}) {
  const [ver, setVer] = useState(abierto)
  return (
    <div className="bg-papel rounded-xl border border-rosa-100/80 shadow-suave overflow-hidden">
      <button onClick={() => setVer(v => !v)} aria-expanded={ver}
        className="w-full min-h-[60px] px-4 py-3 flex items-center gap-3 text-left active:bg-rosa-50 transition-colors">
        {icono && <span className="w-9 h-9 rounded-full bg-rosa-50 text-rosa-600 flex items-center justify-center shrink-0">{icono}</span>}
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold">{titulo}</span>
          {resumen && <span className="block text-[13px] text-tinta-tenue truncate">{resumen}</span>}
        </span>
        <IconoAbajo tam={18} className={`shrink-0 text-tinta-tenue transition-transform duration-200 ${ver ? 'rotate-180' : ''}`} />
      </button>
      {ver && <div className="px-4 pb-4 pt-1 space-y-3 animate-entrada">{children}</div>}
    </div>
  )
}

/** Selector de pestañas (Día / Semana / Mes…) */
export function Pestanas<T extends string>({ opciones, valor, onChange, etiqueta }: {
  opciones: { clave: T; titulo: string }[]; valor: T; onChange: (v: T) => void; etiqueta: string
}) {
  return (
    <div role="tablist" aria-label={etiqueta} className="flex p-1 rounded-full bg-rosa-50 border border-rosa-100">
      {opciones.map(o => (
        <button key={o.clave} role="tab" aria-selected={o.clave === valor} onClick={() => onChange(o.clave)}
          className={`flex-1 min-h-[40px] px-3 rounded-full text-[14px] font-semibold transition
            ${o.clave === valor ? 'bg-papel text-rosa-700 shadow-sm' : 'text-tinta-suave'}`}>
          {o.titulo}
        </button>
      ))}
    </div>
  )
}

/** Varias cifras en una sola tarjeta, separadas por líneas (en vez de una tarjeta por cifra) */
export function Cifras({ datos, columnas }: {
  datos: { etiqueta: string; valor: ReactNode; apoyo?: ReactNode; tono?: 'normal' | 'exito' | 'aviso' | 'error' }[]; columnas?: number
}) {
  const TONOS = { normal: '', exito: 'text-estado-exito', aviso: 'text-estado-aviso', error: 'text-estado-error' }
  return (
    <div className="bg-papel rounded-xl border border-rosa-100/80 shadow-suave grid divide-x divide-rosa-100 overflow-hidden"
         style={{ gridTemplateColumns: `repeat(${columnas ?? datos.length}, minmax(0, 1fr))` }}>
      {datos.map(d => (
        <div key={d.etiqueta} className="px-2 py-3.5 text-center min-w-0">
          <div className={`font-display text-[24px] leading-none ${TONOS[d.tono ?? 'normal']}`}>{d.valor}</div>
          <div className="text-[11px] tracking-wide uppercase text-tinta-tenue mt-1.5 truncate">{d.etiqueta}</div>
          {d.apoyo && <div className="text-[11px] text-tinta-tenue mt-0.5 truncate">{d.apoyo}</div>}
        </div>
      ))}
    </div>
  )
}

// Raya de color a la izquierda de cada cita: de un vistazo se ve cómo va el día
const RAYA: Record<string, string> = {
  CONFIRMADA: 'bg-estado-exito', PENDIENTE: 'bg-estado-aviso', EN_CURSO: 'bg-rosa-500', COMPLETADA: 'bg-rosa-200',
  NO_SHOW: 'bg-estado-error', CANCELADA_CLIENTA: 'bg-tinta-tenue/40', CANCELADA_NEGOCIO: 'bg-tinta-tenue/40',
}

/** Una cita en una lista (Hoy, Agenda): hora, clienta, servicios y estado */
export function FilaCita({ cita, extra }: { cita: CitaAgenda; extra?: ReactNode }) {
  const pasada = ['COMPLETADA', 'NO_SHOW', 'CANCELADA_CLIENTA', 'CANCELADA_NEGOCIO'].includes(cita.status)
  return (
    <Link to={`/panel/cita/${cita.id}`}
      className="relative flex items-start gap-3 bg-papel rounded-xl border border-rosa-100/80 shadow-suave pl-5 pr-4 py-3.5
                 active:bg-rosa-50 transition-colors overflow-hidden">
      <span aria-hidden className={`absolute left-0 inset-y-0 w-1.5 ${RAYA[cita.status] ?? 'bg-rosa-200'}`} />
      <div className={`w-[68px] shrink-0 ${pasada ? 'opacity-60' : ''}`}>
        <div className="font-display text-[18px] leading-tight">{hora(cita.starts_at)}</div>
        <div className="text-[12px] text-tinta-tenue">{duracion(cita.total_duration_minutes)}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[16px] font-medium truncate ${pasada ? 'text-tinta-suave' : ''}`}>{cita.cliente_nombre}</div>
        <ListaServicios texto={cita.servicios} className="text-[13px] text-tinta-tenue mt-0.5" />
        {extra}
      </div>
      <div className="shrink-0 pt-0.5"><Pildora estado={cita.status} /></div>
    </Link>
  )
}
