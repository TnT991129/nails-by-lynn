import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerAjustesPoliticas, guardarAjustesPoliticas, type AjustesPoliticas } from '../../lib/panel/api-panel'
import { Boton, Tarjeta, Aviso, Esqueleto } from '../../componentes/ui'
import { mensajeDeError } from '../../lib/errores'
import { Volver } from './comunes'

type CampoTexto = 'policy_cancellation' | 'policy_reschedule' | 'policy_late' | 'policy_no_show'
  | 'policy_refund' | 'policy_waiting' | 'privacy_notice'
type CampoNumero = 'cancel_blocked_hours' | 'reschedule_min_hours' | 'max_reschedules'
  | 'max_active_appointments_per_phone' | 'max_advance_days' | 'min_advance_hours'

const TEXTOS: { campo: CampoTexto; titulo: string; ejemplo: string }[] = [
  { campo: 'policy_cancellation', titulo: 'Cancelaciones', ejemplo: 'Puedes cancelar sin costo hasta 24 horas antes…' },
  { campo: 'policy_reschedule',   titulo: 'Cambios de fecha u hora', ejemplo: 'Puedes cambiar tu cita hasta 24 horas antes…' },
  { campo: 'policy_late',         titulo: 'Retrasos', ejemplo: 'Tienes 15 minutos de cortesía…' },
  { campo: 'policy_no_show',      titulo: 'Si no asistes', ejemplo: 'Si faltas sin avisar, la próxima reserva…' },
  { campo: 'policy_refund',       titulo: 'Reembolsos', ejemplo: 'Si el trabajo se daña en los primeros días…' },
  { campo: 'policy_waiting',      titulo: 'Tiempo de espera', ejemplo: 'Puede que esperes unos minutos si…' },
  { campo: 'privacy_notice',      titulo: 'Privacidad', ejemplo: 'Tu nombre y teléfono solo se usan para…' },
]

const NUMEROS: { campo: CampoNumero; titulo: string; ayuda: string }[] = [
  { campo: 'min_advance_hours',  titulo: 'Reservar con al menos (horas)', ayuda: 'Antelación mínima para reservar por la web.' },
  { campo: 'max_advance_days',   titulo: 'Reservar hasta (días)', ayuda: 'Cuántos días hacia adelante se ve el calendario.' },
  { campo: 'max_active_appointments_per_phone', titulo: 'Citas pendientes por clienta', ayuda: 'Cuántas citas futuras puede tener a la vez.' },
  { campo: 'cancel_blocked_hours', titulo: 'Cancelar hasta (horas antes)', ayuda: 'Después, solo por WhatsApp.' },
  { campo: 'reschedule_min_hours', titulo: 'Cambiar hasta (horas antes)', ayuda: 'Cambio de fecha desde su enlace.' },
  { campo: 'max_reschedules',      titulo: 'Cambios por cita', ayuda: 'Veces que puede cambiar una misma cita.' },
]

// Lynn edita las políticas que ven las clientas (antes solo se podía por SQL)
export default function PoliticasPanel() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['ajustes-politicas'], queryFn: obtenerAjustesPoliticas })
  const [datos, setDatos] = useState<AjustesPoliticas | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  if (q.data && !datos) setDatos(q.data)

  async function guardar() {
    if (!datos) return
    for (const n of NUMEROS) {
      const v = Number(datos[n.campo])
      if (!Number.isInteger(v) || v < 0) { setError(`Revisa «${n.titulo}»: tiene que ser un número entero.`); return }
    }
    if (datos.max_advance_days < 1 || datos.max_active_appointments_per_phone < 1) {
      setError('Los días hacia adelante y las citas por clienta tienen que ser al menos 1.'); return
    }
    setGuardando(true); setError(null); setGuardado(false)
    try {
      const limpio = { ...datos }
      for (const t of TEXTOS) limpio[t.campo] = limpio[t.campo]?.trim() || null
      await guardarAjustesPoliticas(limpio)
      qc.invalidateQueries({ queryKey: ['ajustes-politicas'] })
      qc.invalidateQueries({ queryKey: ['politicas'] })
      setGuardado(true)
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  return (
    <div className="p-5 space-y-4">
      <Volver />
      <div>
        <h1 className="text-[30px] leading-tight">Políticas</h1>
        <p className="text-[14px] text-tinta-tenue mt-1">
          Lo que leen las clientas antes de reservar. Si dejas un texto vacío, se muestra uno por defecto.
        </p>
      </div>

      {q.isLoading && <Esqueleto className="h-64" />}
      {q.isError && <Aviso>{mensajeDeError(q.error)}</Aviso>}

      {datos && (
        <>
          <Tarjeta className="space-y-3">
            <div className="text-[14px] text-tinta-tenue">Reglas</div>
            {NUMEROS.map(n => (
              <label key={n.campo} className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-[15px]">{n.titulo}</span>
                  <span className="block text-[12px] text-tinta-tenue">{n.ayuda}</span>
                </span>
                <input value={String(datos[n.campo])} inputMode="numeric"
                  onChange={e => setDatos({ ...datos, [n.campo]: Number(e.target.value.replace(/\D/g, '') || 0) })}
                  className="w-20 shrink-0 min-h-[44px] px-3 rounded-lg border border-rosa-200 text-[16px] text-center bg-papel" />
              </label>
            ))}
          </Tarjeta>

          {TEXTOS.map(t => (
            <label key={t.campo} className="block">
              <span className="block text-[14px] font-medium text-tinta-suave mb-1.5">{t.titulo}</span>
              <textarea value={datos[t.campo] ?? ''} rows={3} placeholder={t.ejemplo}
                onChange={e => setDatos({ ...datos, [t.campo]: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-rosa-200 text-[16px] bg-papel
                           focus:outline-none focus:ring-4 focus:ring-rosa-100 focus:border-rosa-500" />
            </label>
          ))}

          {error && <Aviso>{error}</Aviso>}
          {guardado && <p className="text-[14px] text-estado-exito text-center">✓ Guardado. Las clientas ya lo ven.</p>}
          <div className="sticky bottom-20 z-10">
            <Boton ancho onClick={guardar} cargando={guardando}>Guardar políticas</Boton>
          </div>
        </>
      )}
    </div>
  )
}
