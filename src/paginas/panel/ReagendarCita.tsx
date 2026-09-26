import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { disponibilidad, reagendarCita, type CitaAgenda } from '../../lib/panel/api-panel'
import { obtenerDiasLaborables } from '../../lib/api'
import { armarMensaje, enlaceWhatsApp } from '../../lib/panel/whatsapp'
import { Boton, Tarjeta, Aviso, Esqueleto } from '../../componentes/ui'
import { fechaISO, fechaLarga, hora, instanteEnHabana, ZONA } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'

// Mueve una cita a otro día u hora y ofrece avisar a la clienta por WhatsApp
export default function ReagendarCita({ cita, tokenAcceso, onCerrar }: {
  cita: CitaAgenda; tokenAcceso?: string; onCerrar: () => void
}) {
  const qc = useQueryClient()
  const [fecha, setFecha] = useState(fechaISO(new Date()))
  const [horaSel, setHoraSel] = useState('')
  const [otraHora, setOtraHora] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [movidaA, setMovidaA] = useState<string | null>(null)

  // Margen de limpieza que ya tenía la cita (se conserva al moverla)
  const margen = Math.round(
    (new Date(cita.blocked_until).getTime() - new Date(cita.ends_at).getTime()) / 60_000)

  const qDias = useQuery({ queryKey: ['dias-laborables'], queryFn: obtenerDiasLaborables })
  const qHoras = useQuery({
    queryKey: ['disp-reagendar', cita.id, fecha],
    queryFn: () => disponibilidad(fecha, cita.total_duration_minutes, margen),
  })

  const dias = useMemo(() => {
    const hoy = new Date()
    return Array.from({ length: 21 }, (_, i) => {
      const d = new Date(hoy); d.setDate(hoy.getDate() + i); return d
    })
  }, [])

  const inicioElegido = otraHora ? instanteEnHabana(fecha, otraHora) : horaSel

  async function confirmar() {
    if (!inicioElegido) { setError('Elige un turno u otra hora.'); return }
    setGuardando(true); setError(null)
    try {
      await reagendarCita(cita, inicioElegido)
      qc.invalidateQueries()
      setMovidaA(inicioElegido)
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  if (movidaA) {
    const nombre = cita.cliente_nombre.trim().split(/\s+/)[0]
    const avisar = () => {
      const mensaje = armarMensaje('reagendada', {
        cliente_nombre: cita.cliente_nombre,
        starts_at: movidaA,
        servicios: cita.servicios ?? '',
        total_amount: Number(cita.total_amount),
        currency: cita.currency,
        code: cita.code,
        access_token: tokenAcceso ?? '',
      })
      window.open(enlaceWhatsApp(cita.cliente_telefono, mensaje), '_blank', 'noopener,noreferrer')
    }
    return (
      <Tarjeta className="space-y-3">
        <div className="text-[16px] font-medium">
          ✅ Cita movida al {fechaLarga(movidaA)}, {hora(movidaA)}
        </div>
        {tokenAcceso && <Boton ancho onClick={avisar}>Avisar a {nombre} por WhatsApp</Boton>}
        <Boton variante="secundario" ancho onClick={onCerrar}>Listo</Boton>
      </Tarjeta>
    )
  }

  return (
    <Tarjeta className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[16px] font-medium">Reagendar cita</div>
        <button onClick={onCerrar} className="text-tinta-suave min-h-[44px] px-2">Cancelar</button>
      </div>

      <div>
        <div className="text-[14px] text-tinta-tenue mb-2">Nuevo día</div>
        <div className="grid grid-cols-4 gap-2">
          {dias.map(d => {
            const iso = fechaISO(d)
            const activo = fecha === iso
            // Los días sin horario se ven atenuados, pero Lynn puede elegirlos como excepción
            const cerrado = !!qDias.data && !qDias.data.includes(new Date(`${iso}T12:00:00Z`).getUTCDay())
            return (
              <button key={iso} aria-pressed={activo}
                onClick={() => { setFecha(iso); setHoraSel(''); setOtraHora('') }}
                className={`min-h-[56px] rounded border flex flex-col items-center justify-center
                  ${activo ? 'border-rosa-600 bg-rosa-600 text-white' : 'border-rosa-200 bg-white'}
                  ${cerrado && !activo ? 'opacity-40' : ''}`}>
                <span className="text-[11px] uppercase opacity-80">
                  {new Intl.DateTimeFormat('es', { timeZone: ZONA, weekday: 'short' }).format(d)}
                </span>
                <span className="text-[17px] font-semibold">
                  {new Intl.DateTimeFormat('es', { timeZone: ZONA, day: 'numeric' }).format(d)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="text-[14px] text-tinta-tenue mb-2">Turnos libres</div>
        {qHoras.isLoading ? <Esqueleto className="h-12" />
          : qHoras.isError ? <Aviso>{mensajeDeError(qHoras.error)}</Aviso>
          : qHoras.data && qHoras.data.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {qHoras.data.map(h => (
                <button key={h} aria-pressed={horaSel === h}
                  onClick={() => { setHoraSel(h); setOtraHora('') }}
                  className={`min-h-[48px] rounded border text-[16px] font-medium
                    ${horaSel === h ? 'border-rosa-600 bg-rosa-600 text-white' : 'border-rosa-200 bg-white'}`}>
                  {hora(h)}
                </button>
              ))}
            </div>
          ) : <div className="text-[14px] text-tinta-tenue">No quedan turnos libres ese día.</div>}
      </div>

      <div>
        <label htmlFor="otra-hora" className="block text-[14px] text-tinta-tenue mb-2">
          Otra hora (excepción)
        </label>
        <input id="otra-hora" type="time" value={otraHora}
          onChange={e => { setOtraHora(e.target.value); setHoraSel('') }}
          className="w-full min-h-[44px] px-3 rounded-sm border border-rosa-200 text-[16px] bg-white" />
      </div>

      {error && <Aviso>{error}</Aviso>}

      <Boton ancho onClick={confirmar} cargando={guardando} disabled={!inicioElegido}>
        {inicioElegido ? `Mover a las ${hora(inicioElegido)}` : 'Elige un turno'}
      </Boton>
    </Tarjeta>
  )
}
