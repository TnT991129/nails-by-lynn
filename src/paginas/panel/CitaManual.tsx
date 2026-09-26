import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { catalogoServicios, disponibilidad, crearCitaManual } from '../../lib/panel/api-panel'
import { obtenerAddons, obtenerDiasLaborables, obtenerDiasCerrados } from '../../lib/api'
import CalendarioMes, { diaSemana } from '../../componentes/CalendarioMes'
import { Boton, Campo, Aviso, Esqueleto, Etiqueta } from '../../componentes/ui'
import { fechaISO, hora, franja, duracion, dinero, instanteEnHabana } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'
import { Volver } from './comunes'

type Servicio = {
  id: string; name: string; duration_minutes: number;
  price: number; currency: string; buffer_after_minutes: number;
}

export default function CitaManual() {
  const navegar = useNavigate()
  const [servicioId, setServicioId] = useState<string>('')
  const [addonsSel, setAddonsSel] = useState<string[]>([])
  const [fecha, setFecha] = useState<string>(fechaISO(new Date()))
  const [horaSel, setHoraSel] = useState<string>('')
  const [otraHora, setOtraHora] = useState('')   // excepción fuera de los turnos
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const qServ = useQuery<Servicio[]>({
    queryKey: ['cat-serv'],
    queryFn: catalogoServicios as () => Promise<Servicio[]>,
  })
  const qAddons = useQuery({ queryKey: ['addons-manual'], queryFn: obtenerAddons })
  const qDias = useQuery({ queryKey: ['dias-laborables'], queryFn: obtenerDiasLaborables })
  const qCerrados = useQuery({ queryKey: ['dias-cerrados'], queryFn: obtenerDiasCerrados })

  const servicio = qServ.data?.find(s => s.id === servicioId)
  const addonsElegidos = qAddons.data?.filter(a => addonsSel.includes(a.id)) ?? []

  // Duración = servicio + suma de complementos elegidos
  const duracionTotal = useMemo(() => {
    if (!servicio) return 0
    const extra = addonsElegidos.reduce((t, a) => t + Number(a.extra_minutes ?? 0), 0)
    return servicio.duration_minutes + extra
  }, [servicio, addonsElegidos])

  const qHoras = useQuery({
    queryKey: ['disp-manual', fecha, servicioId, addonsSel.join('-')],
    queryFn: () => disponibilidad(fecha, duracionTotal, servicio!.buffer_after_minutes),
    enabled: !!servicio && !!fecha && duracionTotal > 0,
  })

  const inicioElegido = otraHora ? instanteEnHabana(fecha, otraHora) : horaSel
  // Día sin horario o cerrado: Lynn puede agendar igual, poniendo la hora a mano
  const diaCerrado = (!!qDias.data && !qDias.data.includes(diaSemana(fecha)))
    || (qCerrados.data ?? []).some(r => fecha >= r.desde && fecha <= r.hasta)

  function toggleAddon(id: string) {
    setAddonsSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
    setHoraSel(''); setOtraHora('')  // los complementos cambian la duración → recalcular horas
  }

  async function guardar() {
    if (!servicio || !inicioElegido || !nombre.trim() || !telefono.trim()) {
      setError('Completa servicio, fecha, hora, nombre y teléfono.'); return
    }
    setGuardando(true); setError(null)
    try {
      const r = await crearCitaManual({
        inicio: inicioElegido,
        items: [{ service_id: servicio.id, addons: addonsSel }],
        nombre: nombre.trim(), telefono: telefono.trim(),
        nota: nota.trim() || undefined,
      })
      navegar(`/panel/cita/${r.id}`)
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  return (
    <div className="p-5 space-y-5 pb-32">
      <Volver />
      <h1 className="text-[30px] leading-tight">Nueva cita manual</h1>

      {error && <Aviso>{error}</Aviso>}

      <section>
        <Etiqueta>Servicio</Etiqueta>
        {qServ.isLoading && <Esqueleto className="h-20 mt-3" />}
        <div className="space-y-2 mt-3">
          {qServ.data?.map(s => (
            <button key={s.id} onClick={() => {
              setServicioId(s.id); setHoraSel(''); setAddonsSel([])
            }}
              className={`w-full text-left px-4 py-3 rounded border
                ${servicioId === s.id ? 'border-rosa-600 bg-rosa-50' : 'border-rosa-200 bg-white'}`}>
              <div className="flex justify-between">
                <span>{s.name}</span>
                <span className="text-[14px] text-tinta-tenue">
                  {duracion(s.duration_minutes)} · {dinero(Number(s.price), s.currency)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {servicio && qAddons.data && qAddons.data.length > 0 && (
        <section>
          <Etiqueta>Complementos (opcional)</Etiqueta>
          <div className="space-y-2 mt-3">
            {qAddons.data.map(a => {
              const activo = addonsSel.includes(a.id)
              return (
                <button key={a.id} onClick={() => toggleAddon(a.id)}
                  className={`w-full text-left px-4 py-3 rounded border
                    ${activo ? 'border-rosa-600 bg-rosa-50' : 'border-rosa-200 bg-white'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-[14px]">{a.name}</div>
                      <div className="text-[12px] text-tinta-tenue">
                        +{a.extra_minutes} min · +{Number(a.extra_price).toLocaleString('es-CU')} CUP
                      </div>
                    </div>
                    <span className={`text-[18px] ${activo ? 'text-rosa-600' : 'text-tinta-tenue'}`}>
                      {activo ? '✓' : '+'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
          {duracionTotal > 0 && (
            <div className="mt-3 text-[13px] text-tinta-tenue text-right">
              Duración total: <b>{duracion(duracionTotal)}</b>
            </div>
          )}
        </section>
      )}

      {servicio && (
        <section>
          <Etiqueta>Fecha</Etiqueta>
          <div className="mt-3">
            <CalendarioMes fecha={fecha} setFecha={f => { setFecha(f); setHoraSel(''); setOtraHora('') }}
              diasLaborables={qDias.data} diasCerrados={qCerrados.data} maxDias={120} permitirCerrados />
          </div>
        </section>
      )}

      {servicio && (
        <section>
          <Etiqueta>Hora</Etiqueta>
          {qHoras.isLoading && <Esqueleto className="h-16 mt-3" />}
          {diaCerrado && (
            <p className="text-[13px] text-estado-aviso mt-3">
              Ese día está cerrado. Si quieres atender igual, pon la hora abajo en «Otra hora».
            </p>
          )}
          {qHoras.data && qHoras.data.length === 0 && !diaCerrado && (
            <p className="text-[14px] text-tinta-tenue mt-3">No quedan turnos libres ese día.</p>
          )}
          {qHoras.data && (['Mañana','Tarde','Noche'] as const).map(f => {
            const grupo = qHoras.data.filter(h => franja(h) === f)
            if (!grupo.length) return null
            return (
              <div key={f} className="mt-3">
                <div className="text-[12px] tracking-wider text-tinta-tenue mb-1">{f}</div>
                <div className="grid grid-cols-3 gap-2">
                  {grupo.map(h => (
                    <button key={h} onClick={() => { setHoraSel(h); setOtraHora('') }}
                      className={`min-h-[44px] rounded border text-[14px]
                        ${horaSel === h && !otraHora ? 'border-rosa-600 bg-rosa-600 text-white' : 'border-rosa-200 bg-white'}`}>
                      {hora(h)}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {servicio && (
        <section>
          <label htmlFor="otra-hora-manual" className="block text-[14px] text-tinta-suave mb-1.5">
            Otra hora (excepción)
          </label>
          <input id="otra-hora-manual" type="time" value={otraHora}
            onChange={e => { setOtraHora(e.target.value); setHoraSel('') }}
            className="w-full min-h-[48px] px-3 rounded-lg border border-rosa-200 text-[16px] bg-white
                       focus:outline-none focus:ring-4 focus:ring-rosa-100 focus:border-rosa-500" />
          {inicioElegido && (
            <p className="text-[14px] text-rosa-800 mt-2">
              Cita el <b className="first-letter:uppercase">{new Intl.DateTimeFormat('es', { timeZone: 'America/Havana', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(inicioElegido))}</b> a las <b>{hora(inicioElegido)}</b>
            </p>
          )}
        </section>
      )}

      {inicioElegido && (
        <section className="space-y-3">
          <Etiqueta>Clienta</Etiqueta>
          <Campo etiqueta="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
          <Campo etiqueta="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)}
                 inputMode="tel" />
          <label className="block">
            <span className="block text-[14px] text-tinta-suave mb-1.5">Nota (opcional)</span>
            <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2}
              className="w-full px-4 py-3 rounded border border-rosa-200 text-[16px]" />
          </label>
          <Boton ancho onClick={guardar} cargando={guardando}>Crear cita</Boton>
        </section>
      )}
    </div>
  )
}
