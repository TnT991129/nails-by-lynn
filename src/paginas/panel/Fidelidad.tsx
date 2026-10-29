import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerTextosPanel, guardarAjusteWeb, fidelidadInstalada } from '../../lib/panel/api-panel'
import {
  leerFidelidad, limpiarNiveles, tamanoTarjeta, CLAVE_FIDELIDAD, MAX_NIVELES, type ConfigFidelidad, type NivelFidelidad,
} from '../../lib/fidelidad'
import { Boton, Tarjeta, Aviso, Esqueleto } from '../../componentes/ui'
import { IconoCerrar } from '../../componentes/iconos'
import { mensajeDeError } from '../../lib/errores'
import { Volver } from './comunes'

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
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-[16px] font-semibold">Tarjeta activa</div>
            <div className="text-[13px] text-tinta-tenue">{c.activa ? 'Las clientas la ven y ganan premios' : 'Apagada: nadie la ve'}</div>
          </div>
          <Interruptor activo={c.activa} onChange={v => poner({ activa: v })} etiqueta="Tarjeta activa" />
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

      <Tarjeta className="space-y-1">
        <div className="text-[15px] font-semibold">¿Y una clienta en concreto?</div>
        <p className="text-[14px] text-tinta-tenue">
          En la ficha de cada clienta puedes <b>sumarle o quitarle sellos</b> (por ejemplo, si venía antes de la web),
          darle el premio al momento o <b>sacarla de la tarjeta</b>.
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

function Interruptor({ activo, onChange, etiqueta }: { activo: boolean; onChange: (v: boolean) => void; etiqueta: string }) {
  return (
    <button role="switch" aria-checked={activo} aria-label={etiqueta} onClick={() => onChange(!activo)}
      className={`relative w-14 h-8 rounded-full transition-colors duration-300 shrink-0 ${activo ? 'bg-rosa-600' : 'bg-rosa-200'}`}>
      <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform duration-300
                        ease-[cubic-bezier(.34,1.56,.64,1)] ${activo ? 'translate-x-6' : ''}`} />
    </button>
  )
}
