import { useMemo, useState } from 'react'
import { Tarjeta } from './ui'
import { IconoAtras } from './iconos'
import { fechaISO } from '../lib/formato'

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MS_DIA = 86_400_000
export const dos = (n: number) => String(n).padStart(2, '0')
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
export const isoDeUTC = (ms: number) => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`
}
/** Día de la semana (0 = domingo) de una fecha 'YYYY-MM-DD' */
export const diaSemana = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay()

/**
 * Calendario mensual con flechas entre meses, desde hoy (hora de La Habana) hasta hoy + maxDias - 1.
 * Los días sin horario o cerrados salen tachados; con permitirCerrados (panel) se pueden elegir igual.
 */
export default function CalendarioMes({
  fecha, setFecha, diasLaborables, diasCerrados = [], maxDias = 60, permitirCerrados = false,
}: {
  fecha: string | null; setFecha: (f: string) => void
  diasLaborables?: number[]; diasCerrados?: { desde: string; hasta: string }[]
  maxDias?: number; permitirCerrados?: boolean
}) {
  const hoyISO = fechaISO(new Date())
  const [y0, m0, d0] = hoyISO.split('-').map(Number)
  const ultimoISO = isoDeUTC(Date.UTC(y0, m0 - 1, d0) + (maxDias - 1) * MS_DIA)

  // Meses que cubre el rango
  const meses = useMemo(() => {
    const [yf, mf] = ultimoISO.split('-').map(Number)
    const lista: { anio: number; mes: number }[] = []
    for (let a = y0, m = m0; a < yf || (a === yf && m <= mf); m === 12 ? (a++, m = 1) : m++) {
      lista.push({ anio: a, mes: m })
    }
    return lista
  }, [y0, m0, ultimoISO])

  const [indice, setIndice] = useState(() => {
    const i = fecha ? meses.findIndex(x => fecha.startsWith(`${x.anio}-${dos(x.mes)}`)) : 0
    return Math.max(0, i)
  })
  const { anio, mes } = meses[Math.min(indice, meses.length - 1)]
  const desfase = (new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay() + 6) % 7   // lunes = 0
  const diasEnMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  const nombreMes = mayuscula(new Intl.DateTimeFormat('es', { timeZone: 'UTC', month: 'long', year: 'numeric' })
    .format(new Date(Date.UTC(anio, mes - 1, 1))))

  const flecha = 'w-11 h-11 rounded-full flex items-center justify-center text-tinta-suave border border-rosa-100 bg-white disabled:opacity-30'

  return (
    <Tarjeta className="p-4">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setIndice(i => i - 1)} disabled={indice === 0}
                className={flecha} aria-label="Mes anterior"><IconoAtras tam={20} /></button>
        <span className="font-display text-[20px]">{nombreMes}</span>
        <button type="button" onClick={() => setIndice(i => i + 1)} disabled={indice >= meses.length - 1}
                className={flecha} aria-label="Mes siguiente"><IconoAtras tam={20} className="rotate-180" /></button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS_SEMANA.map(d => (
          <span key={d} className="text-[11px] font-semibold text-tinta-tenue py-1">{d}</span>
        ))}
        {Array.from({ length: desfase }).map((_, i) => <span key={`v${i}`} />)}
        {Array.from({ length: diasEnMes }, (_, i) => i + 1).map(dia => {
          const iso = `${anio}-${dos(mes)}-${dos(dia)}`
          const activo = fecha === iso
          const esHoy = iso === hoyISO
          const fueraDeRango = iso < hoyISO || iso > ultimoISO
          // Mientras carga el horario, todos los días del rango quedan habilitados
          const cerrado = (!!diasLaborables && !diasLaborables.includes(diaSemana(iso)))
            || diasCerrados.some(r => iso >= r.desde && iso <= r.hasta)   // vacaciones y días cerrados
          const deshabilitado = fueraDeRango || (cerrado && !permitirCerrados)
          return (
            <button type="button" key={iso} onClick={() => setFecha(iso)} aria-pressed={activo} disabled={deshabilitado}
              aria-label={`${dia} de ${nombreMes}${cerrado && !fueraDeRango ? ', cerrado' : ''}`}
              className={`relative h-11 rounded-full text-[15px] font-medium transition
                ${activo ? 'bg-rosa-600 text-white shadow-boton'
                  : deshabilitado ? 'text-tinta-tenue/35'
                  : cerrado ? 'text-tinta-tenue/60 hover:bg-rosa-50'
                  : 'text-tinta hover:bg-rosa-50'}
                ${esHoy && !activo ? 'ring-1 ring-rosa-300' : ''}
                ${cerrado && !fueraDeRango && !activo ? 'line-through decoration-tinta-tenue/40' : ''}`}>
              {dia}
            </button>
          )
        })}
      </div>
    </Tarjeta>
  )
}

/** Suma días a una fecha 'YYYY-MM-DD' */
export function sumarDias(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number)
  return isoDeUTC(Date.UTC(y, m - 1, d) + n * MS_DIA)
}
