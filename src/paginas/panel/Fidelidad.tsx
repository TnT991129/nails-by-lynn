import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  obtenerTextosPanel, guardarAjusteWeb, fidelidadInstalada, clientasConTarjeta, listarClientas, darTarjetaFidelidad, type Cliente,
} from '../../lib/panel/api-panel'
import {
  leerFidelidad, limpiarNiveles, tamanoTarjeta, CLAVE_FIDELIDAD, MAX_NIVELES, type ConfigFidelidad, type NivelFidelidad, type ModoFidelidad,
} from '../../lib/fidelidad'
import { Boton, Tarjeta, Aviso, Esqueleto } from '../../componentes/ui'
import { IconoCerrar } from '../../componentes/iconos'
import { mensajeDeError } from '../../lib/errores'
import { Volver, Interruptor } from './comunes'

const OPCIONES: { clave: 'apagada' | ModoFidelidad; titulo: string }[] = [
  { clave: 'apagada', titulo: 'Apagada' },
  { clave: 'todas', titulo: 'Para todas' },
  { clave: 'elegidas', titulo: 'Solo las que yo elija' },
]

// Lynn configura la tarjeta: uno o varios premios (p. ej. 5.ª cita → 15 %, 10.ª → 20 %) y si vuelve a empezar.
// Cada cita completada es un sello; al llegar a un premio, la base de datos le deja el descuento para la próxima.
export default function Fidelidad() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['textos-panel'], queryFn: obtenerTextosPanel })
  const qSql = useQuery({ queryKey: ['fidelidad-instalada'], queryFn: fidelidadInstalada })
  const guardada = q.data ? leerFidelidad(q.data) : null
  const [c, setC] = useState<ConfigFidelidad | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)
  if (guardada && !c) setC(guardada)

  if (q.isLoading || !c) return <div className="p-5"><Esqueleto className="h-64" /></div>
  if (q.isError) return <div className="p-5"><Aviso>{mensajeDeError(q.error)}</Aviso></div>

  const listos = limpiarNiveles(c.niveles)
  const cambios = JSON.stringify({ ...c, niveles: listos }) !== JSON.stringify(guardada)
  const poner = (p: Partial<ConfigFidelidad>) => { setC({ ...c, ...p }); setHecho(false) }
  const ponerNivel = (i: number, p: Partial<NivelFidelidad>) => poner({ niveles: c.niveles.map((n, k) => k === i ? { ...n, ...p } : n) })
  const repetidos = new Set(c.niveles.map(n => n.citas)).size !== c.niveles.length
  const tamano = tamanoTarjeta({ ...c, niveles: listos })

  function anadir() {
    const ultima = Math.max(0, ...c!.niveles.map(n => n.citas))
    poner({ niveles: [...c!.niveles, { citas: Math.min(30, ultima + 5), premio: 20 }] })
  }

  async function guardar() {
    if (!c) return
    setGuardando(true); setError(null)
    try {
      const limpia = { ...c, niveles: listos }
      await guardarAjusteWeb(CLAVE_FIDELIDAD, limpia)
      setC(limpia)
      await qc.invalidateQueries({ queryKey: ['textos-panel'] })
      qc.invalidateQueries({ queryKey: ['textos'] })
      setHecho(true)
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  return (
    <div className="p-5 space-y-4">
      <Volver />
      <div>
        <h1 className="text-[30px] leading-tight">Tarjeta de fidelidad</h1>
        <p className="text-[14px] text-tinta-tenue mt-1">
          Cada cita que marques como <b>completada</b> es un sello. Al llegar a un premio, la clienta tiene ese descuento
          en su siguiente cita, sin que hagas nada. Ella ve sus sellos en «Mis citas».
        </p>
      </div>

      {qSql.data === false && (
        <Aviso tipo="aviso">
          Falta ejecutar en Supabase el SQL <b>fidelidad_niveles.sql</b>: hasta entonces las clientas no ven sus sellos ni se dan los premios.
        </Aviso>
      )}

      <Tarjeta className="space-y-5">
        <div>
          <div className="text-[16px] font-semibold mb-2">¿Para quién es?</div>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Para quién es la tarjeta">
            {OPCIONES.map(o => {
              const elegida = o.clave === 'apagada' ? !c.activa : c.activa && c.modo === o.clave
              return (
                <button key={o.clave} role="radio" aria-checked={elegida}
                  onClick={() => poner(o.clave === 'apagada' ? { activa: false } : { activa: true, modo: o.clave })}
                  className={`min-h-[56px] px-2 rounded-xl border text-[13px] font-semibold leading-tight transition
                    ${elegida ? 'bg-rosa-600 border-rosa-600 text-white' : 'border-rosa-200 bg-papel text-tinta-suave'}`}>
                  {o.titulo}
                </button>
              )
            })}
          </div>
          <p className="text-[13px] text-tinta-tenue mt-2">
            {!c.activa ? 'Apagada: nadie la ve ni gana premios.'
              : c.modo === 'todas' ? 'Todas las clientas la tienen. Puedes sacar a alguna desde su ficha.'
              : 'Solo la tienen las clientas que elijas abajo (o desde su ficha).'}
          </p>
        </div>

        <div>
          <div className="text-[14px] font-medium text-tinta-suave mb-2">Premios</div>
          <ul className="space-y-2">
            {c.niveles.map((n, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg border border-rosa-100 bg-rosa-50/40 p-2.5 animate-entrada">
                <span className="text-[14px] text-tinta-suave">En la</span>
                <input type="number" inputMode="numeric" min={1} max={30} value={n.citas}
                       onChange={e => ponerNivel(i, { citas: Number(e.target.value) })} aria-label="Número de cita"
                       className="w-14 min-h-[40px] rounded-lg border border-rosa-200 text-center text-[16px] font-semibold" />
                <span className="text-[14px] text-tinta-suave">.ª cita:</span>
                <input type="number" inputMode="numeric" min={5} max={100} step={5} value={n.premio}
                       onChange={e => ponerNivel(i, { premio: Number(e.target.value) })} aria-label="Porcentaje de descuento"
                       className="w-16 min-h-[40px] rounded-lg border border-rosa-200 text-center text-[16px] font-semibold text-rosa-700" />
                <span className="text-[14px] text-tinta-suave">%</span>
                {c.niveles.length > 1 && (
                  <button onClick={() => poner({ niveles: c.niveles.filter((_, k) => k !== i) })} aria-label="Quitar este premio"
                          className="ml-auto w-9 h-9 rounded-full text-tinta-tenue hover:bg-rosa-100 flex items-center justify-center">
                    <IconoCerrar tam={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {repetidos && <p className="text-[13px] text-estado-aviso mt-2">Hay dos premios en la misma cita: se quedará solo uno.</p>}
          {c.niveles.length < MAX_NIVELES && (
            <button onClick={anadir} className="mt-2 min-h-[44px] text-[14px] font-semibold text-rosa-800">+ Añadir otro premio</button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-[15px] font-medium">Al completarla, vuelve a empezar</div>
            <div className="text-[13px] text-tinta-tenue">
              {c.repetir ? `Después de la ${tamano}.ª cita, la tarjeta empieza de nuevo` : `Los premios se dan una sola vez`}
            </div>
          </div>
          <Interruptor activo={c.repetir} onChange={v => poner({ repetir: v })} etiqueta="Vuelve a empezar" />
        </div>

        {/* Cómo la verán */}
        <div className="rounded-xl bg-gradient-to-br from-rosa-500 via-rosa-600 to-vino text-white p-4">
          <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/80">Así la verán</div>
          <div className="grid grid-cols-5 gap-1.5 mt-3">
            {Array.from({ length: tamano }).map((_, i) => {
              const nivel = listos.find(n => n.citas === i + 1)
              return (
                <span key={i} className={`aspect-square rounded-full flex items-center justify-center text-[11px] font-bold border-2
                  ${i < 2 ? 'bg-white text-rosa-700 border-white' : nivel ? 'border-white/80 bg-white/15' : 'border-white/40 border-dashed'}`}>
                  {i < 2 ? '★' : nivel ? `${nivel.premio}%` : ''}
                </span>
              )
            })}
          </div>
          <p className="text-[12px] text-white/80 mt-2">{listos.map(n => `${n.premio}% en la ${n.citas}.ª cita`).join(' · ')}</p>
        </div>

        {error && <Aviso>{error}</Aviso>}
        <Boton ancho cargando={guardando} disabled={!cambios} onClick={guardar}>
          {hecho && !cambios ? '✓ Guardado' : 'Guardar'}
        </Boton>
      </Tarjeta>

      {c.activa && c.modo === 'elegidas' && <ElegirClientas />}

      <Tarjeta className="space-y-1">
        <div className="text-[15px] font-semibold">¿Y una clienta en concreto?</div>
        <p className="text-[14px] text-tinta-tenue">
          En la ficha de cada clienta puedes <b>sumarle o quitarle sellos</b> (por ejemplo, si venía antes de la web),
          darle el premio al momento y {c.modo === 'elegidas' ? <><b>darle o quitarle la tarjeta</b></> : <><b>sacarla de la tarjeta</b></>}.
        </p>
        <Link to="/panel/clientas" className="inline-flex items-center min-h-[44px] text-[14px] font-semibold text-rosa-800 underline">Ir a Clientas</Link>
      </Tarjeta>

      <p className="text-[13px] text-tinta-tenue px-1">
        El premio se apunta como «descuento para su próxima cita» en la ficha de la clienta: lo puedes ver o quitar allí.
        Si ya tenía un descuento mayor, se queda el mayor.
      </p>
    </div>
  )
}

// «Solo las que yo elija»: quién tiene la tarjeta y un buscador para dársela a más clientas.
// Cada cambio se guarda al momento (no hace falta el botón Guardar de arriba).
function ElegirClientas() {
  const qc = useQueryClient()
  const qCon = useQuery({ queryKey: ['clientas-con-tarjeta'], queryFn: clientasConTarjeta })
  const [busqueda, setBusqueda] = useState('')
  const qBuscar = useQuery({
    queryKey: ['clientas', busqueda.trim()], queryFn: () => listarClientas(busqueda.trim()), enabled: busqueda.trim().length >= 2,
  })
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (qCon.isLoading) return <Esqueleto className="h-32" />
  if (qCon.data === null) {
    return <Aviso tipo="aviso">Para elegir clientas, falta ejecutar en Supabase el SQL <b>fidelidad_elegidas.sql</b>.</Aviso>
  }
  const con = qCon.data ?? []
  const ids = new Set(con.map(x => x.id))
  const encontradas = (qBuscar.data ?? []).filter(x => !ids.has(x.id)).slice(0, 8)

  async function cambiar(cli: Cliente, tiene: boolean) {
    setTrabajando(cli.id); setError(null)
    try {
      await darTarjetaFidelidad(cli.id, tiene)
      await qc.invalidateQueries({ queryKey: ['clientas-con-tarjeta'] })
      qc.invalidateQueries({ queryKey: ['cli', cli.id] })
      if (tiene) setBusqueda('')
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setTrabajando(null) }
  }

  return (
    <Tarjeta className="space-y-3">
      <div>
        <div className="text-[16px] font-semibold">Clientas con tarjeta</div>
        <div className="text-[13px] text-tinta-tenue">
          {con.length === 0 ? 'Todavía ninguna. Búscalas abajo para dársela.' : `${con.length} ${con.length === 1 ? 'clienta' : 'clientas'}`}
        </div>
      </div>

      {con.length > 0 && (
        <ul className="divide-y divide-rosa-100">
          {con.map(x => (
            <li key={x.id} className="flex items-center justify-between gap-2 py-2">
              <Link to={`/panel/clientas/${x.id}`} className="text-[15px] font-medium truncate underline-offset-2 hover:underline">{x.full_name}</Link>
              <button onClick={() => cambiar(x, false)} disabled={trabajando === x.id}
                className="shrink-0 min-h-[36px] px-2 text-[13px] text-estado-error disabled:opacity-50">Quitar</button>
            </li>
          ))}
        </ul>
      )}

      <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o teléfono"
             aria-label="Buscar clienta para darle la tarjeta"
             className="w-full min-h-[44px] px-3 rounded-lg border border-rosa-200 text-[16px] bg-papel" />
      {busqueda.trim().length >= 2 && (
        qBuscar.isLoading ? <Esqueleto className="h-16" />
        : encontradas.length === 0 ? <p className="text-[13px] text-tinta-tenue">No hay más clientas con ese nombre o teléfono.</p>
        : (
          <ul className="space-y-1">
            {encontradas.map(x => (
              <li key={x.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-[15px] truncate">{x.full_name}</span>
                  <span className="block text-[12px] text-tinta-tenue">{x.phone}</span>
                </span>
                <button onClick={() => cambiar(x, true)} disabled={trabajando === x.id}
                  className="shrink-0 min-h-[40px] px-3 rounded-full bg-rosa-600 text-white text-[13px] font-semibold disabled:opacity-50">
                  + Dar tarjeta
                </button>
              </li>
            ))}
          </ul>
        )
      )}
      {error && <Aviso>{error}</Aviso>}
    </Tarjeta>
  )
}
