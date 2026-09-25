import { useEffect, useMemo, useState } from 'react'
import type { Servicio, Addon } from '../../lib/tipos'
import { Tarjeta, Etiqueta, Campo, Esqueleto, Aviso, Vacio } from '../../componentes/ui'
import { dinero, duracion, fechaLarga, hora, franja, fechaISO, cuentaAtras } from '../../lib/formato'
import { validarNombre, validarTelefono, validarEmail } from './validacion'
import type { Datos } from './useReserva'

export function Progreso({ paso }: { paso: number }) {
  const nombres = ['Servicio','Extras','Fecha','Hora','Datos','Listo']
  return (
    <div className="px-5 pb-3">
      <div className="flex gap-1.5 mb-2" role="progressbar"
           aria-valuenow={paso} aria-valuemin={1} aria-valuemax={6}
           aria-label={`Paso ${paso} de 6`}>
        {nombres.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i < paso ? 'bg-rosa-600' : 'bg-rosa-100'}`} />
        ))}
      </div>
      <Etiqueta>{`Paso ${paso} de 6 · ${nombres[paso-1]}`}</Etiqueta>
    </div>
  )
}

export function PasoServicio({
  servicios, seleccionados, alternar,
}: {
  servicios: Servicio[]; seleccionados: string[]; alternar: (id: string) => void
}) {
  return (
    <div className="space-y-6 animate-entrada">
      <h2 className="text-[24px]">¿Qué te vas a hacer?</h2>
      <div className="space-y-3">
        {servicios.map(s => {
          const activo = seleccionados.includes(s.id)
          return (
            <button key={s.id} onClick={() => alternar(s.id)} aria-pressed={activo}
              className={`w-full text-left p-4 rounded-lg border transition-colors duration-150
                ${activo ? 'border-rosa-600 bg-rosa-50' : 'border-rosa-200 bg-white'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[19px] font-semibold">{s.name}</div>
                  <div className="text-[14px] text-tinta-tenue mt-0.5">
                    {duracion(s.duration_minutes)}
                  </div>
                  {s.short_description && (
                    <p className="text-[14px] text-tinta-suave mt-1.5">{s.short_description}</p>
                  )}
                </div>
                <div className="font-display text-[22px] shrink-0">{dinero(Number(s.price), s.currency)}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Paso nuevo: complementos separados del paso de servicio
export function PasoExtras({
  addons, addonsElegidos, alternarAddon,
}: {
  addons: Addon[]; addonsElegidos: string[]; alternarAddon: (id: string) => void
}) {
  return (
    <div className="space-y-6 animate-entrada">
      <h2 className="text-[24px]">¿Necesitas algo más?</h2>
      <p className="text-[14px] text-tinta-suave -mt-3">
        Puedes añadir uno o varios extras. También puedes seguir sin añadir nada.
      </p>
      {addons.length === 0 ? (
        <p className="text-[14px] text-tinta-tenue">
          No hay extras disponibles para este servicio.
        </p>
      ) : (
        <div className="space-y-2">
          {addons.map(a => {
            const activo = addonsElegidos.includes(a.id)
            return (
              <button key={a.id} onClick={() => alternarAddon(a.id)} aria-pressed={activo}
                className={`w-full text-left p-4 rounded-lg border flex items-center justify-between gap-3
                  ${activo ? 'border-rosa-600 bg-rosa-50' : 'border-rosa-200 bg-white'}`}>
                <div>
                  <div className="text-[16px] font-medium">{a.name}</div>
                  <div className="text-[13px] text-tinta-tenue mt-0.5">
                    +{a.extra_minutes} min
                    {Number(a.extra_price) > 0 && ` · ${dinero(Number(a.extra_price))}`}
                  </div>
                </div>
                <span className={`text-[22px] shrink-0 ${activo ? 'text-rosa-600' : 'text-tinta-tenue'}`}>
                  {activo ? '✓' : '+'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function PasoFecha({
  fecha, setFecha, diasLaborables, maxDias = 60,
}: { fecha: string | null; setFecha: (f: string) => void; diasLaborables?: number[]; maxDias?: number }) {
  const dias = useMemo(() => {
    const hoy = new Date()
    return Array.from({ length: maxDias }, (_, i) => {
      const d = new Date(hoy); d.setDate(hoy.getDate() + i)
      return d
    })
  }, [maxDias])

  return (
    <div className="space-y-4 animate-entrada">
      <h2 className="text-[24px]">¿Qué día te viene bien?</h2>
      <div className="grid grid-cols-3 gap-2">
        {dias.slice(0, 21).map(d => {
          const iso = fechaISO(d)
          const activo = fecha === iso
          // Día de la semana de esa fecha (0 = domingo). Mientras carga, todos habilitados.
          const cerrado = !!diasLaborables && !diasLaborables.includes(new Date(`${iso}T12:00:00Z`).getUTCDay())
          const etiqueta = new Intl.DateTimeFormat('es', { timeZone:'America/Havana', weekday:'short' }).format(d)
          const num = new Intl.DateTimeFormat('es', { timeZone:'America/Havana', day:'numeric' }).format(d)
          return (
            <button key={iso} onClick={() => setFecha(iso)} aria-pressed={activo} disabled={cerrado}
              className={`min-h-[64px] rounded border flex flex-col items-center justify-center
                ${activo ? 'border-rosa-600 bg-rosa-600 text-white' : 'border-rosa-200 bg-white'}
                disabled:opacity-40`}>
              <span className="text-[12px] uppercase tracking-wide opacity-80">{etiqueta}</span>
              <span className="text-[19px] font-semibold">{num}</span>
              {cerrado && <span className="text-[11px]">Cerrado</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function PasoHora({
  horas, cargando, error, inicio, onElegir, expiraEn,
}: {
  horas: string[]; cargando: boolean; error: string | null
  inicio: string | null; onElegir: (h: string) => void; expiraEn: string | null
}) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!expiraEn) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [expiraEn])

  const restante = expiraEn ? cuentaAtras(expiraEn) : null
  const urgente = restante !== null && Number(restante.split(':')[0]) < 1
  void tick

  const grupos = useMemo(() => {
    const g: Record<string, string[]> = {}
    horas.forEach(h => { const f = franja(h); (g[f] ??= []).push(h) })
    return g
  }, [horas])

  if (cargando) {
    return (
      <div className="space-y-4">
        <Esqueleto className="h-6 w-40" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => <Esqueleto key={i} className="h-12" />)}
        </div>
      </div>
    )
  }

  if (error) return <Aviso>{error}</Aviso>

  if (horas.length === 0) {
    return <Vacio titulo="No hay horarios ese día"
                  texto="Cada día tengo 2 turnos: 9:00 AM y 1:00 PM. Prueba con otra fecha cercana." />
  }

  return (
    <div className="space-y-6 animate-entrada">
      <h2 className="text-[24px]">Elige tu hora</h2>
      {restante && (
        <p className={`text-[14px] ${urgente ? 'text-estado-aviso' : 'text-tinta-tenue'}`} aria-live="polite">
          Te guardamos este horario · {restante}
        </p>
      )}
      {(['Mañana','Tarde','Noche'] as const).map(f => grupos[f] && (
        <div key={f}>
          <Etiqueta>{f}</Etiqueta>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {grupos[f].map(h => {
              const activo = inicio === h
              return (
                <button key={h} onClick={() => onElegir(h)} aria-pressed={activo}
                  className={`min-h-[48px] rounded border text-[16px] font-medium
                    ${activo ? 'border-rosa-600 bg-rosa-600 text-white' : 'border-rosa-200 bg-white'}`}>
                  {hora(h)}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function PasoDatos({
  datos, setDatos, intentado,
}: { datos: Datos; setDatos: (d: Datos) => void; intentado: boolean }) {
  const set = (k: keyof Datos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDatos({ ...datos, [k]: e.target.value })

  return (
    <div className="space-y-4 animate-entrada">
      <h2 className="text-[24px]">Cuéntanos de ti</h2>
      <Campo etiqueta="Nombre completo" value={datos.nombre} onChange={set('nombre')}
             placeholder="María González" autoComplete="name"
             error={intentado ? validarNombre(datos.nombre) ?? undefined : undefined} />
      <Campo etiqueta="Teléfono" value={datos.telefono} onChange={set('telefono')}
             placeholder="5455 9179" inputMode="tel" autoComplete="tel"
             ayuda="Te escribo aquí para confirmarte la cita."
             error={intentado ? validarTelefono(datos.telefono) ?? undefined : undefined} />
      <Campo etiqueta="Correo (opcional)" value={datos.email} onChange={set('email')}
             placeholder="tucorreo@ejemplo.com" inputMode="email" autoComplete="email"
             error={intentado ? validarEmail(datos.email) ?? undefined : undefined} />
      <Campo etiqueta="Instagram (opcional)" value={datos.instagram} onChange={set('instagram')}
             placeholder="@tuusuario" />
      <label className="block">
        <span className="block text-[14px] font-medium text-tinta-suave mb-1.5">
          ¿Quieres agregar alguna información para tu cita?
        </span>
        <textarea value={datos.nota} rows={3}
          onChange={e => setDatos({ ...datos, nota: e.target.value })}
          placeholder="Prefiero tonos nude, tengo una uña partida…"
          className="w-full px-4 py-3 rounded-sm border border-rosa-200 text-[16px] bg-white
                     placeholder:text-tinta-tenue/60" />
      </label>
    </div>
  )
}

export function PasoResumen({
  servicios, addons, inicio, duracionMin, total, acepta, setAcepta, politica,
}: {
  servicios: Servicio[]; addons: Addon[]; inicio: string
  duracionMin: number; total: number
  acepta: boolean; setAcepta: (v: boolean) => void; politica: string | null
}) {
  return (
    <div className="space-y-5 animate-entrada">
      <h2 className="text-[24px]">Revisa tu cita</h2>
      <Tarjeta className="space-y-3">
        <div>
          {servicios.map(s => (
            <div key={s.id} className="flex justify-between text-[16px]">
              <span>{s.name}</span><span>{dinero(Number(s.price), s.currency)}</span>
            </div>
          ))}
          {addons.map(a => (
            <div key={a.id} className="flex justify-between text-[14px] text-tinta-tenue">
              <span>+ {a.name}</span>
              <span>{Number(a.extra_price) > 0 ? dinero(Number(a.extra_price)) : '—'}</span>
            </div>
          ))}
        </div>
        <hr className="border-rosa-100" />
        <div className="space-y-1">
          <div className="text-[19px] font-semibold capitalize">{fechaLarga(inicio)}</div>
          <div className="text-[16px]">{hora(inicio)}</div>
          <div className="text-[14px] text-tinta-tenue">Duración: {duracion(duracionMin)}</div>
        </div>
        <hr className="border-rosa-100" />
        <div className="flex justify-between items-baseline">
          <span className="text-[14px] text-tinta-tenue">Total</span>
          <span className="font-display text-[22px]">{dinero(total)}</span>
        </div>
      </Tarjeta>

      {politica && (
        <details className="bg-white rounded p-4 border border-rosa-100">
          <summary className="text-[14px] font-medium cursor-pointer">Políticas del estudio</summary>
          <p className="text-[14px] text-tinta-suave mt-3 whitespace-pre-line">{politica}</p>
        </details>
      )}

      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)}
               className="mt-1 w-5 h-5 accent-rosa-600" />
        <span className="text-[14px] text-tinta-suave">
          Acepto las políticas de cancelación del estudio.
        </span>
      </label>
    </div>
  )
}
