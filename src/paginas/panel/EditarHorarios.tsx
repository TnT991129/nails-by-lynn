import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listarHorarios, guardarHorariosDia,
  listarBloqueosFuturos, crearBloqueo, eliminarBloqueo,
  listarDiasCerrados, crearDiasCerrados, eliminarDiasCerrados, citasActivasEntre,
  obtenerTurnosFijos, guardarTurnosFijos, turnosDelDia,
  type ReglaHorario,
} from '../../lib/panel/api-panel'
import { Boton, Tarjeta, Esqueleto, Aviso } from '../../componentes/ui'
import { fechaLarga, hora, fechaISO, instanteEnHabana, horaDeTurno } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'
import { Volver } from './comunes'

const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

export default function EditarHorarios() {
  const [pestaña, setPestaña] = useState<'horario' | 'cerrados' | 'bloqueos'>('horario')

  return (
    <div className="p-5 space-y-4">
      <Volver />
      <h1 className="text-[30px] leading-tight">Horarios</h1>

      <div className="flex gap-1 bg-rosa-50 rounded-full border border-rosa-100 p-1 w-full">
        <button onClick={() => setPestaña('horario')}
          className={`flex-1 px-3 py-2 rounded-full text-[14px] min-h-[40px] font-medium transition
            ${pestaña === 'horario' ? 'bg-white text-rosa-700 shadow-sm' : 'text-tinta-suave'}`}>
          Semanal
        </button>
        <button onClick={() => setPestaña('cerrados')}
          className={`flex-1 px-3 py-2 rounded-full text-[14px] min-h-[40px] font-medium transition
            ${pestaña === 'cerrados' ? 'bg-white text-rosa-700 shadow-sm' : 'text-tinta-suave'}`}>
          Días cerrados
        </button>
        <button onClick={() => setPestaña('bloqueos')}
          className={`flex-1 px-3 py-2 rounded-full text-[14px] min-h-[40px] font-medium transition
            ${pestaña === 'bloqueos' ? 'bg-white text-rosa-700 shadow-sm' : 'text-tinta-suave'}`}>
          Horas
        </button>
      </div>

      {pestaña === 'horario' && <HorarioSemanal />}
      {pestaña === 'cerrados' && <DiasCerrados />}
      {pestaña === 'bloqueos' && <Bloqueos />}
    </div>
  )
}

function HorarioSemanal() {
  const q = useQuery({ queryKey: ['horarios'], queryFn: listarHorarios })
  const qTurnos = useQuery({ queryKey: ['turnos-fijos'], queryFn: obtenerTurnosFijos })
  if (q.isLoading || qTurnos.isLoading) return <Esqueleto className="h-96" />
  if (q.isError) return <Aviso>{mensajeDeError(q.error)}</Aviso>

  // Agrupar reglas por dia
  const porDia: Record<number, ReglaHorario[]> = {}
  for (let d = 0; d < 7; d++) porDia[d] = []
  q.data?.forEach(r => porDia[r.weekday]?.push(r))
  const turnos = qTurnos.data ?? []

  return (
    <div className="space-y-3">
      <EditorTurnos turnos={turnos} porDia={porDia} />
      <p className="text-[13px] text-tinta-tenue pt-2">
        Tu semana. Toca un día para cambiar su horario de apertura; sin horario, el día queda cerrado.
      </p>
      {[1,2,3,4,5,6,0].map(dia => (
        <DiaEditor key={dia} weekday={dia} reglas={porDia[dia]} turnosFijos={turnos} />
      ))}
    </div>
  )
}

// Horas de inicio de los turnos que ven las clientas (iguales todos los días)
function EditorTurnos({ turnos, porDia }: { turnos: string[]; porDia: Record<number, ReglaHorario[]> }) {
  const qc = useQueryClient()
  const [editando, setEditando] = useState(false)
  const [lista, setLista] = useState<string[]>(turnos)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (!editando) setLista(turnos) }, [turnos, editando])

  // Días abiertos en los que algún turno queda fuera del horario de apertura
  const fuera = [1,2,3,4,5,6,0].filter(d => porDia[d].length > 0 && turnosDelDia(porDia[d], lista).length < lista.length)

  async function guardar() {
    setGuardando(true); setError(null)
    try {
      if (lista.filter(Boolean).length === 0) throw new Error('Deja al menos un turno.')
      await guardarTurnosFijos(lista)
      qc.invalidateQueries({ queryKey: ['turnos-fijos'] })
      qc.invalidateQueries({ queryKey: ['turnos'] })
      setEditando(false)
    } catch (e) { setError(e instanceof Error && !('code' in e) ? e.message : mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  return (
    <Tarjeta className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[16px] font-semibold">Horas de los turnos</div>
          <div className="text-[13px] text-tinta-tenue">Las clientas solo pueden reservar a estas horas.</div>
        </div>
        {!editando && <Boton variante="secundario" onClick={() => setEditando(true)} className="!min-h-[40px] !px-4 !text-[14px]">Cambiar</Boton>}
      </div>

      {!editando ? (
        <div className="flex flex-wrap gap-2">
          {turnos.length === 0
            ? <span className="text-[14px] text-tinta-tenue">Sin turnos fijos: se reserva a cualquier hora libre.</span>
            : turnos.map(t => (
              <span key={t} className="px-3 py-1.5 rounded-full bg-rosa-50 text-rosa-800 text-[14px] font-semibold">{horaDeTurno(t)}</span>
            ))}
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map((t, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input type="time" value={t} step={900}
                onChange={e => setLista(lista.map((x, j) => j === i ? e.target.value : x))}
                className="flex-1 min-h-[44px] px-3 rounded-lg border border-rosa-200 text-[16px] bg-white focus:outline-none focus:ring-4 focus:ring-rosa-100 focus:border-rosa-500" />
              <button onClick={() => setLista(lista.filter((_, j) => j !== i))} aria-label="Quitar turno"
                className="min-w-[44px] min-h-[44px] text-estado-error">✕</button>
            </div>
          ))}
          <button onClick={() => setLista([...lista, '16:00'])}
            className="w-full min-h-[44px] text-rosa-800 text-[14px] border border-dashed border-rosa-300 rounded-lg">
            + Añadir turno
          </button>
          {fuera.length > 0 && (
            <Aviso tipo="aviso">
              Algún turno queda fuera del horario de apertura de: {fuera.map(d => DIAS[d]).join(', ')}.
              Ese día no se ofrecerá; amplía su horario si quieres que salga.
            </Aviso>
          )}
          <p className="text-[12px] text-tinta-tenue">
            Las citas ya reservadas no cambian de hora. Revísalas en la Agenda si hace falta.
          </p>
          {error && <Aviso>{error}</Aviso>}
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={() => { setEditando(false); setError(null) }} className="flex-1">Cancelar</Boton>
            <Boton onClick={guardar} cargando={guardando} className="flex-1">Guardar</Boton>
          </div>
        </div>
      )}
    </Tarjeta>
  )
}

function DiaEditor({ weekday, reglas, turnosFijos }: { weekday: number; reglas: ReglaHorario[]; turnosFijos: string[] }) {
  const qc = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [turnos, setTurnos] = useState<{ start_time: string; end_time: string }[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTurnos(reglas.map(r => ({
      start_time: r.start_time.slice(0,5),
      end_time: r.end_time.slice(0,5),
    })))
  }, [reglas])

  function nuevoTurno() {
    setTurnos([...turnos, { start_time: '09:00', end_time: '18:00' }])
  }
  function quitarTurno(i: number) {
    setTurnos(turnos.filter((_, idx) => idx !== i))
  }
  function editar(i: number, campo: 'start_time' | 'end_time', valor: string) {
    setTurnos(turnos.map((t, idx) => idx === i ? { ...t, [campo]: valor } : t))
  }

  async function guardar() {
    setGuardando(true); setError(null)
    try {
      // Validar
      for (const t of turnos) {
        if (t.start_time >= t.end_time) throw new Error('La hora de inicio debe ser menor que la de fin')
      }
      await guardarHorariosDia(weekday, turnos)
      qc.invalidateQueries({ queryKey: ['horarios'] })
      setAbierto(false)
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  const apertura = reglas.map(r => `${r.start_time.slice(0,5)} – ${r.end_time.slice(0,5)}`).join(', ')
  const delDia = turnosDelDia(reglas, turnosFijos)

  return (
    <Tarjeta className="space-y-3">
      <button onClick={() => setAbierto(!abierto)}
        className="w-full text-left flex justify-between items-center min-h-[44px]">
        <div className="min-w-0">
          <div className="text-[16px] font-medium">{DIAS[weekday]}</div>
          {reglas.length === 0 ? (
            <div className="text-[14px] text-tinta-tenue">Cerrado</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {delDia.length > 0 ? delDia.map(t => (
                  <span key={t} className="px-2.5 py-0.5 rounded-full bg-rosa-50 text-rosa-800 text-[13px] font-semibold">
                    {horaDeTurno(t)}
                  </span>
                )) : <span className="text-[13px] text-estado-aviso">Ningún turno cabe en este horario</span>}
              </div>
              <div className="text-[12px] text-tinta-tenue mt-1">Abierto {apertura}</div>
            </>
          )}
        </div>
        <span className="text-tinta-tenue text-[13px] shrink-0">{abierto ? 'Cerrar' : 'Editar'}</span>
      </button>

      {abierto && (
        <div className="space-y-2 pt-2 border-t border-rosa-100">
          {turnos.map((t, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input type="time" value={t.start_time}
                onChange={e => editar(i, 'start_time', e.target.value)}
                className="flex-1 min-h-[44px] px-2 rounded border border-rosa-200 text-[16px]" />
              <span>–</span>
              <input type="time" value={t.end_time}
                onChange={e => editar(i, 'end_time', e.target.value)}
                className="flex-1 min-h-[44px] px-2 rounded border border-rosa-200 text-[16px]" />
              <button onClick={() => quitarTurno(i)}
                className="min-w-[44px] min-h-[44px] text-estado-error">✕</button>
            </div>
          ))}
          <div className="text-[13px] text-tinta-tenue">Horario de apertura de este día</div>
          <button onClick={nuevoTurno}
            className="w-full min-h-[44px] text-rosa-800 text-[14px] border border-dashed border-rosa-300 rounded">
            + Añadir franja horaria
          </button>
          {error && <Aviso>{error}</Aviso>}
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={() => setAbierto(false)} className="flex-1">Cerrar</Boton>
            <Boton onClick={guardar} cargando={guardando} className="flex-1">Guardar</Boton>
          </div>
        </div>
      )}
    </Tarjeta>
  )
}

function Bloqueos() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['bloqueos'], queryFn: listarBloqueosFuturos })
  const [nuevo, setNuevo] = useState(false)
  const [fecha, setFecha] = useState('')
  const [ini, setIni] = useState('09:00')
  const [fin, setFin] = useState('18:00')
  const [motivo, setMotivo] = useState('')
  const [diaCompleto, setDiaCompleto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setGuardando(true); setError(null)
    try {
      if (!fecha) throw new Error('Elige una fecha')
      if (!motivo.trim()) throw new Error('Escribe un motivo')
      if (!diaCompleto && ini >= fin) throw new Error('La hora de inicio debe ser menor que la de fin')
      // Horas de La Habana, aunque el móvil esté en otra zona horaria
      const inicio = instanteEnHabana(fecha, diaCompleto ? '00:00' : ini)
      const cierre = instanteEnHabana(fecha, diaCompleto ? '23:59' : fin)
      await crearBloqueo(inicio, cierre, motivo.trim())
      qc.invalidateQueries({ queryKey: ['bloqueos'] })
      setNuevo(false); setFecha(''); setMotivo(''); setDiaCompleto(false)
      setIni('09:00'); setFin('18:00')
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este bloqueo?')) return
    try {
      await eliminarBloqueo(id)
      qc.invalidateQueries({ queryKey: ['bloqueos'] })
    } catch (e) { alert(mensajeDeError(e)) }
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-tinta-tenue">
        Horas sueltas de un día en las que no aceptas citas (cita médica, un recado…).
        Para días enteros o vacaciones usa «Días cerrados».
      </p>

      {!nuevo && <Boton ancho onClick={() => setNuevo(true)}>+ Nuevo bloqueo</Boton>}

      {nuevo && (
        <Tarjeta className="space-y-3">
          <label className="block">
            <span className="block text-[14px] text-tinta-suave mb-1.5">Fecha</span>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              min={new Date().toISOString().slice(0,10)}
              className="w-full min-h-[44px] px-3 rounded border border-rosa-200 text-[16px]" />
          </label>
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" checked={diaCompleto} onChange={e => setDiaCompleto(e.target.checked)}
              className="w-5 h-5 accent-rosa-600" />
            <span className="text-[14px]">Día completo</span>
          </label>
          {!diaCompleto && (
            <div className="flex gap-2 items-center">
              <input type="time" value={ini} onChange={e => setIni(e.target.value)}
                className="flex-1 min-h-[44px] px-2 rounded border border-rosa-200 text-[16px]" />
              <span>–</span>
              <input type="time" value={fin} onChange={e => setFin(e.target.value)}
                className="flex-1 min-h-[44px] px-2 rounded border border-rosa-200 text-[16px]" />
            </div>
          )}
          <label className="block">
            <span className="block text-[14px] text-tinta-suave mb-1.5">Motivo (para tu registro)</span>
            <input value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: viaje, consulta médica…"
              className="w-full min-h-[44px] px-3 rounded border border-rosa-200 text-[16px]" />
          </label>
          {error && <Aviso>{error}</Aviso>}
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={() => setNuevo(false)} className="flex-1">Cancelar</Boton>
            <Boton onClick={guardar} cargando={guardando} className="flex-1">Guardar</Boton>
          </div>
        </Tarjeta>
      )}

      {q.isLoading && <Esqueleto className="h-20" />}
      {q.isError && <Aviso>{mensajeDeError(q.error)}</Aviso>}
      {q.data && q.data.length === 0 && !nuevo && (
        <p className="text-[14px] text-tinta-tenue text-center py-4">Sin bloqueos futuros.</p>
      )}

      <div className="space-y-2">
        {q.data?.map(b => (
          <Tarjeta key={b.id} className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium first-letter:uppercase">
                {fechaLarga(b.starts_at)}
              </div>
              <div className="text-[13px] text-tinta-tenue">
                {hora(b.starts_at)} – {hora(b.ends_at)}
              </div>
              <div className="text-[13px] text-tinta-suave mt-1 truncate">{b.reason}</div>
            </div>
            <button onClick={() => eliminar(b.id)}
              className="text-estado-error text-[14px] min-h-[44px] px-2">Eliminar</button>
          </Tarjeta>
        ))}
      </div>
    </div>
  )
}

// Vacaciones y días sueltos cerrados: la web los muestra como cerrados y no ofrece turnos
function DiasCerrados() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['dias-cerrados-panel'], queryFn: listarDiasCerrados })
  const hoy = fechaISO(new Date())
  const [nuevo, setNuevo] = useState(false)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [motivo, setMotivo] = useState('')
  const [citas, setCitas] = useState<number | null>(null)   // citas ya reservadas en esas fechas
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function limpiar() {
    setNuevo(false); setDesde(''); setHasta(''); setMotivo(''); setCitas(null); setError(null)
  }

  async function guardar() {
    setError(null)
    const fin = hasta || desde
    if (!desde) { setError('Elige el primer día.'); return }
    if (fin < desde) { setError('El último día no puede ser antes del primero.'); return }
    setGuardando(true)
    try {
      // Primer intento: si hay citas en esas fechas, avisar antes de cerrar
      if (citas === null) {
        const n = await citasActivasEntre(desde, fin)
        if (n > 0) { setCitas(n); return }
      }
      await crearDiasCerrados(desde, fin, motivo.trim())
      qc.invalidateQueries({ queryKey: ['dias-cerrados-panel'] })
      limpiar()
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Volver a abrir estos días?')) return
    try {
      await eliminarDiasCerrados(id)
      qc.invalidateQueries({ queryKey: ['dias-cerrados-panel'] })
    } catch (e) { alert(mensajeDeError(e)) }
  }

  const rango = (d: string, h: string) => d === h
    ? fechaLarga(`${d}T16:00:00Z`)
    : `${fechaLarga(`${d}T16:00:00Z`)} → ${fechaLarga(`${h}T16:00:00Z`)}`

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-tinta-tenue">
        Vacaciones o días libres. Las clientas los verán como cerrados en el calendario.
      </p>

      {!nuevo && <Boton ancho onClick={() => setNuevo(true)}>+ Cerrar días</Boton>}

      {nuevo && (
        <Tarjeta className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-[14px] text-tinta-suave mb-1.5">Desde</span>
              <input type="date" value={desde} min={hoy}
                onChange={e => { setDesde(e.target.value); setCitas(null) }}
                className="w-full min-h-[44px] px-2 rounded border border-rosa-200 text-[16px]" />
            </label>
            <label className="block">
              <span className="block text-[14px] text-tinta-suave mb-1.5">Hasta</span>
              <input type="date" value={hasta} min={desde || hoy}
                onChange={e => { setHasta(e.target.value); setCitas(null) }}
                className="w-full min-h-[44px] px-2 rounded border border-rosa-200 text-[16px]" />
            </label>
          </div>
          <p className="text-[12px] text-tinta-tenue -mt-1">Para un solo día deja «Hasta» vacío.</p>
          <label className="block">
            <span className="block text-[14px] text-tinta-suave mb-1.5">Motivo (solo lo ves tú)</span>
            <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: vacaciones"
              className="w-full min-h-[44px] px-3 rounded border border-rosa-200 text-[16px]" />
          </label>
          {citas !== null && (
            <Aviso tipo="aviso">
              Tienes <b>{citas} {citas === 1 ? 'cita' : 'citas'}</b> en esas fechas. Cerrar los días no las cancela:
              reagéndalas o avisa a esas clientas desde la Agenda. Pulsa «Cerrar igualmente» para continuar.
            </Aviso>
          )}
          {error && <Aviso>{error}</Aviso>}
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={limpiar} className="flex-1">Cancelar</Boton>
            <Boton onClick={guardar} cargando={guardando} className="flex-1">
              {citas ? 'Cerrar igualmente' : 'Guardar'}
            </Boton>
          </div>
        </Tarjeta>
      )}

      {q.isLoading && <Esqueleto className="h-20" />}
      {q.isError && <Aviso>{mensajeDeError(q.error)}</Aviso>}
      {q.data && q.data.length === 0 && !nuevo && (
        <p className="text-[14px] text-tinta-tenue text-center py-4">No hay días cerrados próximos.</p>
      )}

      <div className="space-y-2">
        {q.data?.map(d => (
          <Tarjeta key={d.id} className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium first-letter:uppercase">{rango(d.date_from, d.date_to)}</div>
              {d.reason && <div className="text-[13px] text-tinta-suave mt-1 truncate">{d.reason}</div>}
            </div>
            <button onClick={() => eliminar(d.id)}
              className="text-estado-error text-[14px] min-h-[44px] px-2">Abrir</button>
          </Tarjeta>
        ))}
      </div>
    </div>
  )
}
