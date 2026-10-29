import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerTextosPanel, guardarAjusteWeb, funcionesNuevasInstaladas } from '../../lib/panel/api-panel'
import { leerFidelidad, CLAVE_FIDELIDAD, type ConfigFidelidad } from '../../lib/fidelidad'
import { Boton, Tarjeta, Aviso, Esqueleto } from '../../componentes/ui'
import { mensajeDeError } from '../../lib/errores'
import { Volver } from './comunes'

// Lynn configura la tarjeta de sellos: cada cita completada es un sello y, al llenarla,
// la base de datos le deja el descuento para la próxima cita (tg_premio_fidelidad).
export default function Fidelidad() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['textos-panel'], queryFn: obtenerTextosPanel })
  const qSql = useQuery({ queryKey: ['funciones-nuevas'], queryFn: funcionesNuevasInstaladas })
  const guardada = q.data ? leerFidelidad(q.data) : null
  const [c, setC] = useState<ConfigFidelidad | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)
  if (guardada && !c) setC(guardada)

  if (q.isLoading || !c) return <div className="p-5"><Esqueleto className="h-64" /></div>
  if (q.isError) return <div className="p-5"><Aviso>{mensajeDeError(q.error)}</Aviso></div>

  const cambios = JSON.stringify(c) !== JSON.stringify(guardada)
  const poner = (p: Partial<ConfigFidelidad>) => { setC({ ...c, ...p }); setHecho(false) }

  async function guardar() {
    if (!c) return
    setGuardando(true); setError(null)
    try {
      await guardarAjusteWeb(CLAVE_FIDELIDAD, c)
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
          Cada cita que marques como <b>completada</b> es un sello. Al llenar la tarjeta, la clienta tiene el descuento
          en su siguiente cita, sin que hagas nada. Ella ve sus sellos en «Mis citas».
        </p>
      </div>

      {qSql.data === false && (
        <Aviso tipo="aviso">
          Falta ejecutar en Supabase el SQL <b>inspiracion_fidelidad_visitas.sql</b>: hasta entonces las clientas no ven sus
          sellos ni se da el premio.
        </Aviso>
      )}

      <Tarjeta className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-[16px] font-semibold">Tarjeta activa</div>
            <div className="text-[13px] text-tinta-tenue">{c.activa ? 'Las clientas la ven y ganan premios' : 'Apagada: nadie la ve'}</div>
          </div>
          <button role="switch" aria-checked={c.activa} aria-label="Tarjeta activa" onClick={() => poner({ activa: !c.activa })}
            className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${c.activa ? 'bg-rosa-600' : 'bg-rosa-200'}`}>
            <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform duration-300
                              ease-[cubic-bezier(.34,1.56,.64,1)] ${c.activa ? 'translate-x-6' : ''}`} />
          </button>
        </div>

        <div>
          <div className="text-[14px] font-medium text-tinta-suave mb-2">Sellos para el premio</div>
          <div className="flex items-center gap-3">
            <button onClick={() => poner({ sellos: Math.max(2, c.sellos - 1) })} aria-label="Menos sellos"
                    className="w-12 h-12 rounded-full border border-rosa-200 text-[22px] text-rosa-700">−</button>
            <span className="font-display text-[34px] w-16 text-center tabular-nums">{c.sellos}</span>
            <button onClick={() => poner({ sellos: Math.min(20, c.sellos + 1) })} aria-label="Más sellos"
                    className="w-12 h-12 rounded-full border border-rosa-200 text-[22px] text-rosa-700">+</button>
            <span className="text-[13px] text-tinta-tenue">citas completadas</span>
          </div>
        </div>

        <label className="block">
          <span className="flex justify-between text-[14px] font-medium text-tinta-suave">
            <span>Descuento del premio</span><span className="tabular-nums text-rosa-700 font-semibold">{c.premio} %</span>
          </span>
          <input type="range" min={5} max={100} step={5} value={c.premio} onChange={e => poner({ premio: Number(e.target.value) })}
                 className="w-full accent-rosa-600 mt-2" />
          {c.premio === 100 && <span className="text-[13px] text-tinta-tenue">La cita del premio sale gratis.</span>}
        </label>

        {/* Cómo la verán */}
        <div className="rounded-xl bg-gradient-to-br from-rosa-500 via-rosa-600 to-vino text-white p-4">
          <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/80">Así la verán</div>
          <div className="font-display text-[19px] mt-1">{c.sellos - 3 > 0 ? c.sellos - 3 : 1} citas para tu {c.premio}% de descuento</div>
          <div className="grid grid-cols-5 gap-1.5 mt-3">
            {Array.from({ length: c.sellos }).map((_, i) => (
              <span key={i} className={`aspect-square rounded-full flex items-center justify-center text-[13px] border-2
                ${i < 3 ? 'bg-white text-rosa-700 border-white' : 'border-white/40 border-dashed'}`}>{i < 3 ? '★' : ''}</span>
            ))}
          </div>
        </div>

        {error && <Aviso>{error}</Aviso>}
        <Boton ancho cargando={guardando} disabled={!cambios} onClick={guardar}>
          {hecho && !cambios ? '✓ Guardado' : 'Guardar'}
        </Boton>
      </Tarjeta>

      <p className="text-[13px] text-tinta-tenue px-1">
        El premio se apunta como «descuento para su próxima cita» en la ficha de la clienta: lo puedes ver o quitar allí.
        Si ya tenía un descuento mayor, se queda el mayor.
      </p>
    </div>
  )
}
