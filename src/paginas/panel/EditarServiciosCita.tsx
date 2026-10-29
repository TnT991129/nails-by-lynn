import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerServicios, obtenerAddons } from '../../lib/api'
import { serviciosDeCita, editarCitaPanel, type CitaAgenda } from '../../lib/panel/api-panel'
import { Boton, Tarjeta, Aviso, Esqueleto, Etiqueta } from '../../componentes/ui'
import EnCup from '../../componentes/EnCup'
import { dinero, duracion, precioRango } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'

// Lynn cambia los servicios y complementos de una cita (la fecha se cambia con «Reagendar»)
export default function EditarServiciosCita({ cita, onCerrar }: { cita: CitaAgenda; onCerrar: () => void }) {
  const qc = useQueryClient()
  const qServ = useQuery({ queryKey: ['servicios'], queryFn: obtenerServicios })
  const qAddons = useQuery({ queryKey: ['addons'], queryFn: obtenerAddons })
  const qActual = useQuery({ queryKey: ['servicios-cita', cita.id], queryFn: () => serviciosDeCita(cita.id), staleTime: 0 })
  const [elegidos, setElegidos] = useState<string[] | null>(null)
  const [extras, setExtras] = useState<string[] | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Se marcan los que ya lleva la cita
  if (qActual.data && elegidos === null) {
    setElegidos(qActual.data.map(i => i.service_id).filter((x): x is string => !!x))
    setExtras([...new Set(qActual.data.flatMap(i => i.addons))])
  }

  const sel = elegidos ?? []
  const servicios = useMemo(() => (qServ.data ?? []).filter(s => (elegidos ?? []).includes(s.id)), [qServ.data, elegidos])
  const aplicables = (qAddons.data ?? []).filter(a => a.service_id === null || sel.includes(a.service_id))
  const activos = aplicables.filter(a => (extras ?? []).includes(a.id))
  const minutos = servicios.reduce((t, s) => t + s.duration_minutes, 0) + activos.reduce((t, a) => t + a.extra_minutes, 0)
  const base = servicios.reduce((t, s) => t + Number(s.price), 0)
  const minimo = base + activos.reduce((t, a) => t + Number(a.extra_price), 0)
  const maximo = base + activos.reduce((t, a) => t + Number(a.extra_price_max ?? a.extra_price), 0)
  const pct = Number(cita.discount_percent ?? 0)
  const conDesc = (n: number) => n - Math.round(n * pct) / 100
  // Servicios de la cita que ya no están activos: no se pueden volver a guardar
  const retirados = (qActual.data ?? []).filter(i => i.service_id && !(qServ.data ?? []).some(s => s.id === i.service_id)).length

  const alternar = (lista: string[] | null, id: string) => {
    const l = lista ?? []
    return l.includes(id) ? l.filter(x => x !== id) : [...l, id]
  }

  async function guardar() {
    if (servicios.length === 0) { setError('Elige al menos un servicio.'); return }
    setGuardando(true); setError(null)
    // Como al reservar: cada complemento una sola vez (los generales, con el primer servicio)
    const items = servicios.map((s, i) => ({
      service_id: s.id,
      addons: activos.filter(a => a.service_id === s.id || (i === 0 && !servicios.some(x => x.id === a.service_id))).map(a => a.id),
    }))
    try {
      await editarCitaPanel(cita.id, items, cita.client_note)
      qc.invalidateQueries()   // cambian total, duración, agenda y estadísticas
      onCerrar()
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  if (qServ.isLoading || qAddons.isLoading || qActual.isLoading) return <Esqueleto className="h-64" />
  if (qActual.isError) return <Aviso>{mensajeDeError(qActual.error)}</Aviso>

  const boton = (activo: boolean) => `w-full text-left px-4 py-3 rounded border flex items-center gap-3
    ${activo ? 'border-rosa-600 bg-rosa-50' : 'border-rosa-200 bg-papel'}`

  return (
    <Tarjeta className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[16px] font-medium">Cambiar servicios</div>
        <button onClick={onCerrar} className="text-tinta-suave min-h-[44px] px-2">Cancelar</button>
      </div>

      {retirados > 0 && (
        <p className="text-[13px] text-estado-aviso">
          La cita lleva {retirados === 1 ? 'un servicio que ya no está activo' : 'servicios que ya no están activos'}:
          al guardar se quitará. Actívalo en Servicios si quieres conservarlo.
        </p>
      )}

      <section>
        <Etiqueta>Servicios</Etiqueta>
        <div className="space-y-2 mt-2">
          {(qServ.data ?? []).map(s => {
            const activo = sel.includes(s.id)
            return (
              <button key={s.id} onClick={() => setElegidos(l => alternar(l, s.id))} aria-pressed={activo} className={boton(activo)}>
                <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center text-[11px] font-bold
                  ${activo ? 'bg-rosa-600 border-rosa-600 text-white' : 'border-rosa-200'}`}>{activo ? '✓' : ''}</span>
                <span className="flex-1">{s.name}</span>
                <span className="text-[14px] text-tinta-tenue">{duracion(s.duration_minutes)} · {dinero(Number(s.price))}</span>
              </button>
            )
          })}
        </div>
      </section>

      {aplicables.length > 0 && (
        <section>
          <Etiqueta>Complementos</Etiqueta>
          <div className="space-y-2 mt-2">
            {aplicables.map(a => {
              const activo = (extras ?? []).includes(a.id)
              return (
                <button key={a.id} onClick={() => setExtras(l => alternar(l, a.id))} aria-pressed={activo} className={boton(activo)}>
                  <span className="flex-1">
                    <span className="block text-[14px]">{a.name}</span>
                    <span className="block text-[12px] text-tinta-tenue">
                      +{a.extra_minutes} min · +{precioRango(Number(a.extra_price), a.extra_price_max)}
                    </span>
                  </span>
                  <span className={`text-[18px] ${activo ? 'text-rosa-600' : 'text-tinta-tenue'}`}>{activo ? '✓' : '+'}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <div className="flex justify-between items-baseline border-t border-rosa-100 pt-3">
        <span className="text-[14px] text-tinta-tenue">
          {servicios.length === 0 ? 'Elige al menos un servicio' : `Nuevo total · ${duracion(minutos)}`}
        </span>
        {servicios.length > 0 && (
          <span className="text-right font-display text-[20px] text-rosa-700">
            {precioRango(conDesc(minimo), maximo > minimo ? conDesc(maximo) : null)}
            <EnCup min={conDesc(minimo)} max={maximo > minimo ? conDesc(maximo) : null} />
          </span>
        )}
      </div>
      {pct > 0 && <p className="text-[12px] text-estado-exito -mt-2">Incluye su {pct}% de descuento</p>}
      {minutos > cita.total_duration_minutes && (
        <p className="text-[12px] text-tinta-tenue -mt-2">La cita durará más; si choca con la siguiente te avisaremos.</p>
      )}

      {error && <Aviso>{error}</Aviso>}

      <Boton ancho cargando={guardando} disabled={servicios.length === 0} onClick={guardar}>Guardar cambios</Boton>
    </Tarjeta>
  )
}
