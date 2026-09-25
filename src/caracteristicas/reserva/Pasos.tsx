import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Servicio, Addon } from '../../lib/tipos'
import { Tarjeta, Campo, Esqueleto, Aviso, Vacio } from '../../componentes/ui'
import { IconoCheck, IconoReloj, IconoSol, IconoTarde, IconoCalendario, IconoAtras } from '../../componentes/iconos'
import { dinero, duracion, fechaLarga, hora, franja, fechaISO, cuentaAtras } from '../../lib/formato'
import { validarNombre, validarTelefono, validarEmail } from './validacion'
import { EnlacePoliticas } from '../../componentes/Politicas'
import type { Datos } from './useReserva'

const NOMBRES_PASOS = ['Servicio','Extras','Fecha','Hora','Datos','Listo']

export function Progreso({ paso }: { paso: number }) {
  return (
    <div className="px-5 pb-3">
      <div className="flex gap-1.5 mb-2" role="progressbar"
           aria-valuenow={paso} aria-valuemin={1} aria-valuemax={6}
           aria-label={`Paso ${paso} de 6`}>
        {NOMBRES_PASOS.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300
                                   ${i < paso ? 'bg-rosa-600' : 'bg-rosa-100'}`} />
        ))}
      </div>
      <div className="flex justify-between text-[12px]">
        <span className="font-semibold text-rosa-700">{NOMBRES_PASOS[paso-1]}</span>
        <span className="text-tinta-tenue">Paso {paso} de 6</span>
      </div>
    </div>
  )
}

function Titulo({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div>
      <h2 className="text-[28px] leading-tight">{titulo}</h2>
      {texto && <p className="text-[14px] text-tinta-tenue mt-1.5">{texto}</p>}
    </div>
  )
}

/** Círculo de selección: vacío o relleno con check */
function Marca({ activo }: { activo: boolean }) {
  return (
    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition
                      ${activo ? 'bg-rosa-600 border-rosa-600 text-white' : 'border-rosa-200 bg-white'}`}>
      {activo && <IconoCheck tam={14} strokeWidth={3} />}
    </span>
  )
}

const opcion = (activo: boolean) =>
  `w-full text-left p-4 rounded-xl border bg-white transition duration-150 active:scale-[0.99]
   ${activo ? 'border-rosa-600 ring-4 ring-rosa-100' : 'border-rosa-100 shadow-suave'}`

export function PasoServicio({
  servicios, seleccionados, alternar,
}: {
  servicios: Servicio[]; seleccionados: string[]; alternar: (id: string) => void
}) {
  return (
    <div className="space-y-5 animate-entrada">
      <Titulo titulo="¿Qué te vas a hacer?" texto="Puedes elegir más de un servicio." />
      <div className="space-y-3">
        {servicios.map(s => {
          const activo = seleccionados.includes(s.id)
          return (
            <button key={s.id} onClick={() => alternar(s.id)} aria-pressed={activo} className={opcion(activo)}>
              <div className="flex items-start gap-3">
                <Marca activo={activo} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[17px] font-semibold">{s.name}</span>
                    <span className="font-display text-[19px] text-rosa-700 shrink-0">
                      {dinero(Number(s.price), s.currency)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[13px] text-tinta-tenue mt-1">
                    <IconoReloj tam={14} /> {duracion(s.duration_minutes)}
                  </div>
                  {s.short_description && (
                    <p className="text-[14px] text-tinta-suave mt-2">{s.short_description}</p>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function PasoExtras({
  addons, addonsElegidos, alternarAddon,
}: {
  addons: Addon[]; addonsElegidos: string[]; alternarAddon: (id: string) => void
}) {
  return (
    <div className="space-y-5 animate-entrada">
      <Titulo titulo="¿Necesitas algo más?"
        texto="Añade uno o varios extras, o sigue sin añadir nada." />
      {addons.length === 0 ? (
        <p className="text-[14px] text-tinta-tenue">No hay extras disponibles para este servicio.</p>
      ) : (
        <div className="space-y-2.5">
          {addons.map(a => {
            const activo = addonsElegidos.includes(a.id)
            return (
              <button key={a.id} onClick={() => alternarAddon(a.id)} aria-pressed={activo} className={opcion(activo)}>
                <div className="flex items-center gap-3">
                  <Marca activo={activo} />
                  <div className="flex-1">
                    <div className="text-[16px] font-medium">{a.name}</div>
                    <div className="text-[13px] text-tinta-tenue mt-0.5">+{a.extra_minutes} min</div>
                  </div>
                  {Number(a.extra_price) > 0 && (
                    <span className="text-[14px] font-semibold text-rosa-700 shrink-0">
                      +{dinero(Number(a.extra_price))}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MS_DIA = 86_400_000
const dos = (n: number) => String(n).padStart(2, '0')
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const isoDeUTC = (ms: number) => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`
}

// Calendario mensual. maxDias = 60 coincide con settings.max_advance_days del servidor.
export function PasoFecha({
  fecha, setFecha, diasLaborables, diasCerrados = [], maxDias = 60,
}: {
  fecha: string | null; setFecha: (f: string) => void
  diasLaborables?: number[]; diasCerrados?: { desde: string; hasta: string }[]; maxDias?: number
}) {
  // "Hoy" según La Habana, no según la hora del móvil
  const hoyISO = fechaISO(new Date())
  const [y0, m0, d0] = hoyISO.split('-').map(Number)
  const ultimoISO = isoDeUTC(Date.UTC(y0, m0 - 1, d0) + (maxDias - 1) * MS_DIA)

  // Meses que cubre el rango (normalmente 2 o 3)
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
  const { anio, mes } = meses[indice]
  const desfase = (new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay() + 6) % 7   // lunes = 0
  const diasEnMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  const nombreMes = mayuscula(new Intl.DateTimeFormat('es', { timeZone: 'UTC', month: 'long', year: 'numeric' })
    .format(new Date(Date.UTC(anio, mes - 1, 1))))

  const flecha = 'w-11 h-11 rounded-full flex items-center justify-center text-tinta-suave border border-rosa-100 bg-white disabled:opacity-30'

  return (
    <div className="space-y-5 animate-entrada">
      <Titulo titulo="¿Qué día te viene bien?" texto="Trabajo de lunes a sábado." />

      <Tarjeta className="p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setIndice(i => i - 1)} disabled={indice === 0}
                  className={flecha} aria-label="Mes anterior"><IconoAtras tam={20} /></button>
          <span className="font-display text-[20px]">{nombreMes}</span>
          <button onClick={() => setIndice(i => i + 1)} disabled={indice === meses.length - 1}
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
            const cerrado = (!!diasLaborables && !diasLaborables.includes(new Date(`${iso}T12:00:00Z`).getUTCDay()))
              || diasCerrados.some(r => iso >= r.desde && iso <= r.hasta)   // vacaciones y días cerrados
            const deshabilitado = fueraDeRango || cerrado
            return (
              <button key={iso} onClick={() => setFecha(iso)} aria-pressed={activo} disabled={deshabilitado}
                aria-label={`${dia} de ${nombreMes}${cerrado && !fueraDeRango ? ', cerrado' : ''}`}
                className={`relative h-11 rounded-full text-[15px] font-medium transition
                  ${activo ? 'bg-rosa-600 text-white shadow-boton'
                    : deshabilitado ? 'text-tinta-tenue/35'
                    : 'text-tinta hover:bg-rosa-50'}
                  ${esHoy && !activo ? 'ring-1 ring-rosa-300' : ''}
                  ${cerrado && !fueraDeRango ? 'line-through decoration-tinta-tenue/40' : ''}`}>
                {dia}
              </button>
            )
          })}
        </div>
      </Tarjeta>

      {fecha ? (
        <p className="flex items-center gap-2 text-[15px] bg-rosa-50 text-rosa-800 rounded-lg px-4 py-3">
          <IconoCalendario tam={18} />
          <span>Elegiste el <b>{fechaLarga(`${fecha}T16:00:00Z`)}</b></span>
        </p>
      ) : (
        <p className="text-[13px] text-tinta-tenue text-center">
          Puedes reservar hasta {maxDias} días por adelantado.
        </p>
      )}
    </div>
  )
}

export function PasoHora({
  horas, cargando, error, inicio, onElegir, expiraEn, siNoHay,
}: {
  horas: string[]; cargando: boolean; error: string | null
  inicio: string | null; onElegir: (h: string) => void; expiraEn: string | null
  siNoHay?: ReactNode   // lo que se ofrece cuando el día está lleno (lista de espera)
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

  if (cargando) {
    return (
      <div className="space-y-4">
        <Esqueleto className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3">
          <Esqueleto className="h-32" /><Esqueleto className="h-32" />
        </div>
      </div>
    )
  }

  if (error) return <Aviso>{error}</Aviso>

  if (horas.length === 0) {
    return <Vacio titulo="No hay turnos libres ese día"
                  texto="Cada día tengo 2 turnos: 9:00 AM y 1:00 PM. Prueba con otra fecha cercana.">
      {siNoHay}
    </Vacio>
  }

  return (
    <div className="space-y-5 animate-entrada">
      <Titulo titulo="Elige tu turno" />
      {restante && (
        <p className={`inline-flex items-center gap-2 text-[13px] font-medium px-3 py-1.5 rounded-full
                       ${urgente ? 'bg-[#FDF3E3] text-estado-aviso' : 'bg-rosa-50 text-rosa-800'}`}
           aria-live="polite">
          <IconoReloj tam={15} /> Te guardamos este turno · {restante}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {horas.map(h => {
          const activo = inicio === h
          const manana = franja(h) === 'Mañana'
          return (
            <button key={h} onClick={() => onElegir(h)} aria-pressed={activo}
              className={`rounded-xl border p-4 text-left flex flex-col gap-3 min-h-[128px] transition active:scale-[0.98]
                ${activo ? 'border-rosa-600 bg-rosa-600 text-white shadow-boton' : 'border-rosa-100 bg-white shadow-suave'}`}>
              <span className={`w-10 h-10 rounded-full flex items-center justify-center
                                ${activo ? 'bg-white/20' : 'bg-rosa-50 text-rosa-600'}`}>
                {manana ? <IconoSol tam={21} /> : <IconoTarde tam={21} />}
              </span>
              <span>
                <span className={`block text-[12px] uppercase tracking-wider ${activo ? 'text-white/80' : 'text-tinta-tenue'}`}>
                  {franja(h)}
                </span>
                <span className="block text-[22px] font-semibold leading-tight">{hora(h)}</span>
              </span>
            </button>
          )
        })}
      </div>
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
      <Titulo titulo="Cuéntanos de ti" texto="Solo lo necesario para confirmarte la cita." />
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
          ¿Algo que deba saber? (opcional)
        </span>
        <textarea value={datos.nota} rows={3}
          onChange={e => setDatos({ ...datos, nota: e.target.value })}
          placeholder="Prefiero tonos nude, tengo una uña partida…"
          className="w-full px-4 py-3 rounded-lg border border-rosa-200 text-[16px] bg-white transition
                     focus:outline-none focus:ring-4 focus:ring-rosa-100 focus:border-rosa-500
                     placeholder:text-tinta-tenue/60" />
      </label>
    </div>
  )
}

export function PasoResumen({
  servicios, addons, inicio, duracionMin, total, acepta, setAcepta,
}: {
  servicios: Servicio[]; addons: Addon[]; inicio: string
  duracionMin: number; total: number
  acepta: boolean; setAcepta: (v: boolean) => void
}) {
  return (
    <div className="space-y-5 animate-entrada">
      <Titulo titulo="Revisa tu cita" texto="Si todo está bien, confírmala abajo." />
      <Tarjeta className="p-0 overflow-hidden">
        <div className="bg-rosa-600 text-white p-5 flex items-center gap-4">
          <span className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <IconoCalendario tam={22} />
          </span>
          <div>
            <div className="text-[18px] font-semibold capitalize">{fechaLarga(inicio)}</div>
            <div className="text-[14px] text-white/85">{hora(inicio)} · {duracion(duracionMin)}</div>
          </div>
        </div>
        <div className="p-5 space-y-2">
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
          <div className="border-t border-dashed border-rosa-200 !mt-4 pt-4 flex justify-between items-baseline">
            <span className="text-[14px] text-tinta-tenue">Total</span>
            <span className="font-display text-[26px] text-rosa-700">{dinero(total)}</span>
          </div>
        </div>
      </Tarjeta>

      <label className="flex items-start gap-3 cursor-pointer bg-white rounded-lg border border-rosa-100 p-4">
        <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)}
               className="mt-0.5 w-5 h-5 accent-rosa-600 shrink-0" />
        <span className="text-[14px] text-tinta-suave">
          Acepto las <EnlacePoliticas />.
        </span>
      </label>

      <div className="flex gap-3 items-start bg-[#E9FBF0] border border-[#25D366]/30 rounded-lg p-4">
        <span className="w-7 h-7 rounded-full bg-[#25D366] text-white text-[14px] font-bold
                         flex items-center justify-center shrink-0" aria-hidden>!</span>
        <p className="text-[14px] text-tinta-suave">
          <b className="text-tinta">Importante:</b> al confirmar, toca el botón verde
          <b className="text-tinta"> «Avisar a Lynn por WhatsApp»</b> para que sepa de tu cita y te la confirme.
        </p>
      </div>
    </div>
  )
}
