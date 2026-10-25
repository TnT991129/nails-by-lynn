import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerAjustesPoliticas, guardarAjustesPoliticas, type AjustesPoliticas } from '../../lib/panel/api-panel'
import { obtenerPoliticas } from '../../lib/api'
import { seccionesPorDefecto } from '../../componentes/Politicas'
import type { SeccionPolitica } from '../../lib/tipos'
import { Boton, Tarjeta, Aviso, Esqueleto } from '../../componentes/ui'
import { mensajeDeError } from '../../lib/errores'
import { Volver } from './comunes'

type CampoNumero = 'cancel_blocked_hours' | 'reschedule_min_hours' | 'max_reschedules'
  | 'max_active_appointments_per_phone' | 'max_advance_days' | 'min_advance_hours'

const NUMEROS: { campo: CampoNumero; titulo: string; ayuda: string }[] = [
  { campo: 'min_advance_hours',  titulo: 'Reservar con al menos (horas)', ayuda: 'Antelación mínima para reservar por la web.' },
  { campo: 'max_advance_days',   titulo: 'Reservar hasta (días)', ayuda: 'Cuántos días hacia adelante se ve el calendario.' },
  { campo: 'max_active_appointments_per_phone', titulo: 'Citas pendientes por clienta', ayuda: 'Cuántas citas futuras puede tener a la vez.' },
  { campo: 'cancel_blocked_hours', titulo: 'Cancelar hasta (horas antes)', ayuda: 'Después, solo por WhatsApp.' },
  { campo: 'reschedule_min_hours', titulo: 'Cambiar hasta (horas antes)', ayuda: 'Cambio de fecha desde su enlace.' },
  { campo: 'max_reschedules',      titulo: 'Cambios por cita', ayuda: 'Veces que puede cambiar una misma cita.' },
]

const campo = 'w-full px-3 py-2 rounded-lg border border-rosa-200 text-[16px] bg-papel ' +
  'focus:outline-none focus:ring-4 focus:ring-rosa-100 focus:border-rosa-500'

// Lynn edita las reglas y las políticas que ven las clientas (antes solo se podía por SQL)
export default function PoliticasPanel() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['ajustes-politicas'], queryFn: obtenerAjustesPoliticas })
  // Lo que ven hoy las clientas: sirve de punto de partida si Lynn aún no escribió sus secciones
  const qPublicas = useQuery({ queryKey: ['politicas'], queryFn: obtenerPoliticas })
  const [datos, setDatos] = useState<AjustesPoliticas | null>(null)
  const [lista, setLista] = useState<SeccionPolitica[] | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  if (q.data && !datos) setDatos(q.data)
  if (q.data && qPublicas.data && !lista) {
    const propias = q.data.policy_sections ?? []
    setLista(propias.length > 0 ? propias : seccionesPorDefecto(qPublicas.data))
  }

  function cambiar(i: number, cambios: Partial<SeccionPolitica>) {
    setLista(l => (l ?? []).map((s, j) => j === i ? { ...s, ...cambios } : s))
    setGuardado(false)
  }
  function mover(i: number, paso: -1 | 1) {
    setLista(l => {
      const n = [...(l ?? [])]
      const j = i + paso
      if (j < 0 || j >= n.length) return n
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
    })
    setGuardado(false)
  }
  function quitar(i: number) {
    const s = lista?.[i]
    if (s && (s.titulo.trim() || s.texto.trim()) && !confirm(`¿Quitar la sección «${s.titulo.trim() || 'sin título'}»?`)) return
    setLista(l => (l ?? []).filter((_, j) => j !== i))
    setGuardado(false)
  }

  async function guardar() {
    if (!datos || !lista) return
    for (const n of NUMEROS) {
      const v = Number(datos[n.campo])
      if (!Number.isInteger(v) || v < 0) { setError(`Revisa «${n.titulo}»: tiene que ser un número entero.`); return }
    }
    if (datos.max_advance_days < 1 || datos.max_active_appointments_per_phone < 1) {
      setError('Los días hacia adelante y las citas por clienta tienen que ser al menos 1.'); return
    }
    const limpias = lista
      .map(s => ({ titulo: s.titulo.trim().slice(0, 80), texto: s.texto.trim().slice(0, 2000) }))
      .filter(s => s.titulo || s.texto)
    const incompleta = limpias.find(s => !s.titulo || !s.texto)
    if (incompleta) {
      setError(incompleta.titulo ? `Escribe el texto de «${incompleta.titulo}».` : 'Hay una sección con texto pero sin título.')
      return
    }
    setGuardando(true); setError(null); setGuardado(false)
    try {
      // Sin secciones, la web vuelve a mostrar los textos de siempre
      await guardarAjustesPoliticas({ ...datos, policy_sections: limpias.length > 0 ? limpias : null })
      qc.invalidateQueries({ queryKey: ['ajustes-politicas'] })
      qc.invalidateQueries({ queryKey: ['politicas'] })
      setLista(limpias.length > 0 ? limpias : qPublicas.data ? seccionesPorDefecto(qPublicas.data) : [])
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
          Lo que leen las clientas antes de reservar.
        </p>
      </div>

      {(q.isLoading || qPublicas.isLoading) && <Esqueleto className="h-64" />}
      {q.isError && <Aviso>{mensajeDeError(q.error)}</Aviso>}
      {qPublicas.isError && <Aviso>{mensajeDeError(qPublicas.error)}</Aviso>}

      {datos && lista && (
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

          <div className="pt-2">
            <h2 className="text-[19px] font-semibold">Textos de las políticas</h2>
            <p className="text-[13px] text-tinta-tenue mt-1">
              Escribe, cambia, ordena o quita las secciones que quieras. Las clientas las ven en este orden.
              Si cambias una regla de arriba, revisa que el texto diga lo mismo.
            </p>
          </div>

          {lista.map((s, i) => (
            <Tarjeta key={i} className="space-y-2">
              <div className="flex items-center gap-2">
                <input value={s.titulo} onChange={e => cambiar(i, { titulo: e.target.value })}
                  placeholder="Título (p. ej. Cancelaciones)" maxLength={80}
                  aria-label={`Título de la sección ${i + 1}`}
                  className={`${campo} font-semibold min-h-[44px]`} />
              </div>
              <textarea value={s.texto} onChange={e => cambiar(i, { texto: e.target.value })} rows={4}
                placeholder="Lo que quieres que lean las clientas…" maxLength={2000}
                aria-label={`Texto de la sección ${i + 1}`} className={campo} />
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1">
                  <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir"
                    className="w-11 h-11 rounded-full border border-rosa-200 text-tinta-suave disabled:opacity-40">↑</button>
                  <button onClick={() => mover(i, 1)} disabled={i === lista.length - 1} aria-label="Bajar"
                    className="w-11 h-11 rounded-full border border-rosa-200 text-tinta-suave disabled:opacity-40">↓</button>
                </div>
                <button onClick={() => quitar(i)} className="min-h-[44px] px-3 text-[14px] text-estado-error">
                  Quitar sección
                </button>
              </div>
            </Tarjeta>
          ))}

          <Boton variante="secundario" ancho
            onClick={() => { setLista(l => [...(l ?? []), { titulo: '', texto: '' }]); setGuardado(false) }}>
            + Añadir sección
          </Boton>

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
