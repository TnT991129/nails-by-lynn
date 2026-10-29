import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  citasEnRango, listarHorarios, obtenerTurnosFijos, listarDiasCerrados, turnosDelDia,
  bloqueosEnRango, obtenerAjustesPoliticas, crearBloqueo, eliminarBloqueo,
  type CitaAgenda, type ReglaHorario, type DiaCerrado,
} from '../../lib/panel/api-panel'
import { Tarjeta, Esqueleto, Aviso, Pildora, estiloBoton } from '../../componentes/ui'
import { IconoAtras, IconoMas } from '../../componentes/iconos'
import { hora, duracion, fechaLarga, fechaISO, instanteEnHabana, horaDeTurno } from '../../lib/formato'
import { diaSemana, sumarDias, dos } from '../../componentes/CalendarioMes'
import { mensajeDeError } from '../../lib/errores'
import { ListaServicios } from './comunes'

type Vista = 'dia' | 'semana' | 'mes'
const VISTAS: { v: Vista; texto: string }[] = [{ v: 'dia', texto: 'Día' }, { v: 'semana', texto: 'Semana' }, { v: 'mes', texto: 'Mes' }]
const LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

// ---------- Turnos de un día: libres u ocupados ----------
// Un turno sin cita no siempre lo ven las clientas: la web no ofrece los que están más cerca que la
// antelación mínima (Políticas) ni los que chocan con un bloqueo. Aquí se muestran igual que allí.
type EstadoTurno = 'libre' | 'pronto' | 'bloqueado' | 'pasado'
type Turno = { t: string; inicio: string; cita: CitaAgenda | null; estado: EstadoTurno; motivo?: string | null; bloqueo?: Bloqueo }
type Jornada = { iso: string; cerrado: boolean; turnos: Turno[]; otras: CitaAgenda[] }
type Bloqueo = { id: string; starts_at: string; ends_at: string; reason: string | null }
type Reglas = { reglas: ReglaHorario[]; fijos: string[]; cerrados: DiaCerrado[]; bloqueos: Bloqueo[]; horasMinimas: number | null }

// Lo que ocupa una cita estándar (90 min + 15 de margen): la web exige que quepa entera
const VENTANA_MS = 105 * 60_000

function jornada(iso: string, { reglas, fijos, cerrados, bloqueos, horasMinimas }: Reglas, citas: CitaAgenda[]): Jornada {
  const delDia = citas.filter(c => fechaISO(new Date(c.starts_at)) === iso)
  const cerrado = cerrados.some(r => iso >= r.date_from && iso <= r.date_to)
    || !reglas.some(r => r.weekday === diaSemana(iso) && r.is_active)
  const horas = cerrado ? [] : turnosDelDia(reglas.filter(r => r.weekday === diaSemana(iso)), fijos)
  const usadas = new Set<string>()
  const turnos = horas.map(t => {
    const inicio = instanteEnHabana(iso, t)
    const ms = new Date(inicio).getTime()
    // Ocupado si alguna cita cubre la hora del turno
    const cita = delDia.find(c => new Date(c.starts_at).getTime() <= ms && ms < new Date(c.blocked_until).getTime()) ?? null
    if (cita) usadas.add(cita.id)
    const ahora = Date.now()
    const bloqueo = bloqueos.find(b => new Date(b.starts_at).getTime() < ms + VENTANA_MS && new Date(b.ends_at).getTime() > ms)
    const estado: EstadoTurno = ms <= ahora ? 'pasado'
      : bloqueo ? 'bloqueado'
      : horasMinimas && ms < ahora + horasMinimas * 3_600_000 ? 'pronto'
      : 'libre'
    // motivo: el del bloqueo, o las horas de antelación que pide la web
    return { t, inicio, cita, estado, motivo: estado === 'pronto' ? `${horasMinimas} h` : bloqueo?.reason, bloqueo }
  })
  return { iso, cerrado, turnos, otras: delDia.filter(c => !usadas.has(c.id)) }
}

function lunesDe(iso: string) { return sumarDias(iso, -((diaSemana(iso) + 6) % 7)) }
function nombreMes(iso: string) {
  const t = new Intl.DateTimeFormat('es', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${iso}T12:00:00Z`))
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export default function Agenda() {
  const hoy = fechaISO(new Date())
  const [vista, setVista] = useState<Vista>('dia')
  const [ref, setRef] = useState(hoy)

  // Días que se muestran según la vista
  const dias = useMemo(() => {
    if (vista === 'dia') return [ref]
    if (vista === 'semana') return Array.from({ length: 7 }, (_, i) => sumarDias(lunesDe(ref), i))
    const [y, m] = ref.split('-').map(Number)
    const total = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return Array.from({ length: total }, (_, i) => `${y}-${dos(m)}-${dos(i + 1)}`)
  }, [vista, ref])

  const desde = instanteEnHabana(dias[0], '00:00')
  const hasta = instanteEnHabana(sumarDias(dias[dias.length - 1], 1), '00:00')

  const q = useQuery({ queryKey: ['agenda', desde, hasta], queryFn: () => citasEnRango(desde, hasta) })
  const qReglas = useQuery({ queryKey: ['horarios'], queryFn: listarHorarios })
  const qTurnos = useQuery({ queryKey: ['turnos-fijos'], queryFn: obtenerTurnosFijos })
  const qCerrados = useQuery({ queryKey: ['dias-cerrados-panel'], queryFn: listarDiasCerrados })
  const qBloqueos = useQuery({ queryKey: ['bloqueos', desde, hasta], queryFn: () => bloqueosEnRango(desde, hasta) as Promise<Bloqueo[]> })
  const qAjustes = useQuery({ queryKey: ['ajustes-politicas'], queryFn: obtenerAjustesPoliticas })

  const activas = (q.data ?? []).filter(c => c.status !== 'CANCELADA_CLIENTA' && c.status !== 'CANCELADA_NEGOCIO')
  const reglas: Reglas = {
    reglas: qReglas.data ?? [], fijos: qTurnos.data ?? [], cerrados: qCerrados.data ?? [],
    bloqueos: qBloqueos.data ?? [], horasMinimas: qAjustes.data?.min_advance_hours ?? null,
  }
  const jornadas = dias.map(d => jornada(d, reglas, activas))

  function mover(dir: -1 | 1) {
    if (vista === 'dia') setRef(sumarDias(ref, dir))
    else if (vista === 'semana') setRef(sumarDias(ref, dir * 7))
    else {
      const [y, m] = ref.split('-').map(Number)
      const nuevo = new Date(Date.UTC(y, m - 1 + dir, 1))
      setRef(`${nuevo.getUTCFullYear()}-${dos(nuevo.getUTCMonth() + 1)}-01`)
    }
  }

  const titulo = vista === 'dia'
    ? fechaLarga(`${ref}T16:00:00Z`)
    : vista === 'semana'
      ? `Semana del ${Number(dias[0].slice(8))} al ${Number(dias[6].slice(8))}`
      : nombreMes(ref)

  const cargando = q.isLoading || qReglas.isLoading || qTurnos.isLoading
  const esHoy = vista === 'dia' ? ref === hoy : dias.includes(hoy)

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[30px] leading-tight">Agenda</h1>
        <Link to="/panel/agenda/nueva" className={`${estiloBoton('primario')} !min-h-[44px] !px-4 !text-[14px]`}>
          <IconoMas tam={16} strokeWidth={2.4} /> Cita manual
        </Link>
      </div>

      <div className="flex gap-1 bg-rosa-50 rounded-full border border-rosa-100 p-1 w-full">
        {VISTAS.map(({ v, texto }) => (
          <button key={v} onClick={() => setVista(v)}
            className={`flex-1 px-3 py-2 rounded-full text-[14px] font-medium min-h-[40px] transition
              ${vista === v ? 'bg-papel text-rosa-700 shadow-sm' : 'text-tinta-suave'}`}>
            {texto}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => mover(-1)} aria-label="Anterior"
          className="w-11 h-11 rounded-full border border-rosa-100 bg-papel flex items-center justify-center text-tinta-suave">
          <IconoAtras tam={20} />
        </button>
        <div className="text-center">
          <div className="text-[16px] font-medium first-letter:uppercase">{titulo}</div>
          {!esHoy && (
            <button onClick={() => setRef(hoy)} className="text-[13px] text-rosa-800 underline min-h-[28px]">Volver a hoy</button>
          )}
        </div>
        <button onClick={() => mover(1)} aria-label="Siguiente"
          className="w-11 h-11 rounded-full border border-rosa-100 bg-papel flex items-center justify-center text-tinta-suave">
          <IconoAtras tam={20} className="rotate-180" />
        </button>
      </div>

      {cargando && <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Esqueleto key={i} className="h-20" />)}</div>}
      {q.isError && <Aviso>{mensajeDeError(q.error)}</Aviso>}

      {!cargando && vista === 'dia' && <VistaDia j={jornadas[0]} />}
      {!cargando && vista === 'semana' && (
        <div className="space-y-4">
          {jornadas.map(j => <VistaDia key={j.iso} j={j} compacta />)}
        </div>
      )}
      {!cargando && vista === 'mes' && (
        <VistaMes jornadas={jornadas} hoy={hoy} alElegir={iso => { setRef(iso); setVista('dia') }} />
      )}
    </div>
  )
}

// ---------- Día (y cada día de la semana) ----------
// Bloquear desde la agenda: un turno (una hora desde su inicio: basta para que la web no lo ofrezca)
// o el día entero. Es lo mismo que Más → Horarios → Bloqueos, sin salir de aquí.
const MOTIVO_TURNO = 'Bloqueado desde la agenda'
const MOTIVO_DIA = 'Día bloqueado desde la agenda'

function useBloqueos() {
  const qc = useQueryClient()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function hacer(clave: string, accion: () => Promise<unknown>) {
    setOcupado(clave); setError(null)
    try {
      await accion()
      await qc.invalidateQueries({ queryKey: ['bloqueos'] })
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setOcupado(null) }
  }
  return {
    ocupado, error,
    bloquearTurno: (tu: Turno) => hacer(tu.inicio, () =>
      crearBloqueo(tu.inicio, new Date(new Date(tu.inicio).getTime() + 60 * 60_000).toISOString(), MOTIVO_TURNO)),
    bloquearDia: (iso: string) => hacer(iso, () =>
      crearBloqueo(instanteEnHabana(iso, '00:00'), instanteEnHabana(sumarDias(iso, 1), '00:00'), MOTIVO_DIA)),
    desbloquear: (b: Bloqueo) => {
      const varios = new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime() > 26 * 3_600_000
      const rango = `${fechaLarga(b.starts_at)} ${hora(b.starts_at)} – ${varios ? fechaLarga(b.ends_at) + ' ' : ''}${hora(b.ends_at)}`
      if (!confirm(`¿Quitar el bloqueo del ${rango}${b.reason ? ` («${b.reason}»)` : ''}?
Las clientas podrán volver a reservar esas horas.`)) return
      return hacer(b.id, () => eliminarBloqueo(b.id))
    },
  }
}

function VistaDia({ j, compacta = false }: { j: Jornada; compacta?: boolean }) {
  const pasado = j.iso < fechaISO(new Date())
  const b = useBloqueos()
  const bloqueables = j.turnos.filter(tu => !tu.cita && (tu.estado === 'libre' || tu.estado === 'pronto'))
  return (
    <section className="space-y-2">
      {(compacta || (!pasado && bloqueables.length > 1)) && (
        <div className="flex items-center justify-between gap-2 pt-1">
          {compacta ? <h3 className="text-[14px] font-semibold first-letter:uppercase">{fechaLarga(`${j.iso}T16:00:00Z`)}</h3> : <span />}
          {!pasado && bloqueables.length > 1 && (
            <button onClick={() => b.bloquearDia(j.iso)} disabled={b.ocupado !== null}
              className="text-[13px] text-tinta-tenue underline min-h-[36px] disabled:opacity-50">
              {b.ocupado === j.iso ? 'Bloqueando…' : '🔒 Bloquear el día'}
            </button>
          )}
        </div>
      )}
      {b.error && <Aviso>{b.error}</Aviso>}
      {j.cerrado && j.otras.length === 0 && (
        <div className="rounded-lg border border-dashed border-rosa-200 px-4 py-3 text-[14px] text-tinta-tenue">Cerrado</div>
      )}
      {j.turnos.map(tu => tu.cita
        ? <FilaCita key={tu.t} c={tu.cita} />
        : (
          <div key={tu.t} className={`flex items-center gap-3 rounded-lg border border-dashed bg-papel/60 px-4 py-3
                                      ${tu.estado === 'pronto' ? 'border-estado-aviso/50' : 'border-rosa-200'}
                                      ${tu.estado === 'pasado' ? 'opacity-60' : ''}`}>
            <div className="min-w-[64px] font-display text-[17px] text-tinta-suave">{horaDeTurno(tu.t)}</div>
            <div className="flex-1 min-w-0 text-[14px]">
              {tu.estado === 'libre' && <span className="text-estado-exito font-medium">Libre</span>}
              {tu.estado === 'pasado' && <span className="text-tinta-tenue">Ya pasó</span>}
              {tu.estado === 'bloqueado' && (
                <span className="text-tinta-tenue font-medium">Bloqueado{tu.motivo ? ` · ${tu.motivo}` : ''}
                  <span className="block text-[12px] font-normal">Las clientas no lo ven en la web</span></span>
              )}
              {tu.estado === 'pronto' && (
                <span className="text-estado-aviso font-medium">Libre · solo por WhatsApp
                  <span className="block text-[12px] font-normal text-tinta-tenue">
                    La web pide {tu.motivo} de antelación: las clientas no lo ven
                  </span></span>
              )}
            </div>
            {!pasado && tu.estado !== 'pasado' && tu.estado !== 'bloqueado' && (
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => b.bloquearTurno(tu)} disabled={b.ocupado !== null} aria-label={`Bloquear el turno de las ${horaDeTurno(tu.t)}`}
                  title="Bloquear: las clientas no podrán reservarlo"
                  className="w-9 h-9 rounded-full text-tinta-tenue hover:bg-rosa-50 flex items-center justify-center disabled:opacity-40">
                  {b.ocupado === tu.inicio ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : '🔒'}
                </button>
                <Link to={`/panel/agenda/nueva?fecha=${j.iso}`} className="text-[13px] text-rosa-800 font-semibold min-h-[36px] inline-flex items-center px-1">
                  + Agendar
                </Link>
              </div>
            )}
            {!pasado && tu.estado === 'bloqueado' && tu.bloqueo && (
              <button onClick={() => b.desbloquear(tu.bloqueo!)} disabled={b.ocupado !== null}
                className="text-[13px] text-rosa-800 font-semibold min-h-[36px] shrink-0 disabled:opacity-40">
                {b.ocupado === tu.bloqueo.id ? 'Quitando…' : '🔓 Desbloquear'}
              </button>
            )}
          </div>
        ))}
      {j.otras.length > 0 && (
        <>
          {j.turnos.length > 0 && <div className="text-[12px] text-tinta-tenue pt-1">Fuera de turno</div>}
          {j.otras.map(c => <FilaCita key={c.id} c={c} />)}
        </>
      )}
    </section>
  )
}

function FilaCita({ c }: { c: CitaAgenda }) {
  return (
    <Link to={`/panel/cita/${c.id}`} className="block">
      <Tarjeta className="flex items-start gap-3 !py-3.5">
        <div className="text-center min-w-[64px] pt-0.5">
          <div className="font-display text-[17px]">{hora(c.starts_at)}</div>
          <div className="text-[11px] text-tinta-tenue">{duracion(c.total_duration_minutes)}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[15px] font-medium truncate">{c.cliente_nombre}</div>
            <div className="shrink-0"><Pildora estado={c.status} /></div>
          </div>
          <ListaServicios texto={c.servicios} className="text-[13px] text-tinta-tenue mt-1" />
        </div>
      </Tarjeta>
    </Link>
  )
}

// ---------- Mes: un punto por turno (relleno = ocupado) ----------
function VistaMes({ jornadas, hoy, alElegir }: { jornadas: Jornada[]; hoy: string; alElegir: (iso: string) => void }) {
  const desfase = (diaSemana(jornadas[0].iso) + 6) % 7
  const ocupados = jornadas.reduce((t, j) => t + j.turnos.filter(x => x.cita).length, 0)
  const libres = jornadas.reduce((t, j) => t + j.turnos.filter(x => !x.cita && (x.estado === 'libre' || x.estado === 'pronto')).length, 0)
  const extras = jornadas.reduce((t, j) => t + j.otras.length, 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Tarjeta className="text-center !py-3">
          <div className="text-[11px] uppercase tracking-wider text-tinta-tenue">Turnos ocupados</div>
          <div className="font-display text-[26px]">{ocupados + extras}</div>
        </Tarjeta>
        <Tarjeta className="text-center !py-3">
          <div className="text-[11px] uppercase tracking-wider text-tinta-tenue">Libres (desde hoy)</div>
          <div className="font-display text-[26px] text-estado-exito">{libres}</div>
        </Tarjeta>
      </div>

      <Tarjeta className="p-3">
        <div className="grid grid-cols-7 gap-1 text-center">
          {LETRAS.map(l => <span key={l} className="text-[11px] font-semibold text-tinta-tenue py-1">{l}</span>)}
          {Array.from({ length: desfase }).map((_, i) => <span key={`v${i}`} />)}
          {jornadas.map(j => {
            const esHoy = j.iso === hoy
            return (
              <button key={j.iso} onClick={() => alElegir(j.iso)}
                className={`min-h-[52px] rounded-lg flex flex-col items-center justify-center gap-1 transition hover:bg-rosa-50
                  ${esHoy ? 'ring-1 ring-rosa-300' : ''} ${j.iso < hoy ? 'opacity-50' : ''}`}>
                <span className={`text-[14px] font-medium ${j.cerrado && j.otras.length === 0 ? 'text-tinta-tenue/50 line-through' : ''}`}>
                  {Number(j.iso.slice(8))}
                </span>
                <span className="flex gap-0.5 h-2">
                  {j.turnos.map(tu => (
                    <span key={tu.t} className={`w-2 h-2 rounded-full ${tu.cita ? 'bg-rosa-600'
                      : tu.estado === 'bloqueado' ? 'bg-tinta-tenue/40'
                      : tu.estado === 'pronto' ? 'border border-estado-aviso'
                      : 'border border-rosa-300'}`} />
                  ))}
                  {j.otras.map(c => <span key={c.id} className="w-2 h-2 rounded-full bg-tinta-suave" />)}
                </span>
              </button>
            )
          })}
        </div>
      </Tarjeta>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-tinta-tenue px-1">
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rosa-600" /> Ocupado</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full border border-rosa-300" /> Libre</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full border border-estado-aviso" /> Solo por WhatsApp</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-tinta-tenue/40" /> Bloqueado</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-tinta-suave" /> Fuera de turno</span>
        <span>Toca un día para verlo.</span>
      </div>
    </div>
  )
}
