import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  obtenerTextosPanel, guardarAjusteWeb, recomendacionesInstaladas, listaRecomendaciones,
} from '../../lib/panel/api-panel'
import { leerRecomendaciones, CLAVE_RECOMENDACIONES, type ConfigRecomendaciones } from '../../lib/recomendaciones'
import { Boton, Tarjeta, Aviso, Esqueleto } from '../../componentes/ui'
import { mensajeDeError } from '../../lib/errores'
import { Volver, Interruptor } from './comunes'

// Una clienta trae a una amiga: cuando la amiga completa su primera cita, la base de datos les deja
// un descuento a las dos para su próxima cita (supabase/recomendaciones_y_bonos.sql).
export default function Recomendaciones() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['textos-panel'], queryFn: obtenerTextosPanel })
  const qSql = useQuery({ queryKey: ['recomendaciones-instaladas'], queryFn: recomendacionesInstaladas })
  const qLista = useQuery({ queryKey: ['recomendaciones'], queryFn: listaRecomendaciones, enabled: qSql.data === true })
  const guardada = q.data ? leerRecomendaciones(q.data) : null
  const [c, setC] = useState<ConfigRecomendaciones | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)
  if (guardada && !c) setC(guardada)

  if (q.isLoading || !c) return <div className="p-5"><Esqueleto className="h-64" /></div>
  if (q.isError) return <div className="p-5"><Aviso>{mensajeDeError(q.error)}</Aviso></div>

  const limpia = leerRecomendaciones({ [CLAVE_RECOMENDACIONES]: JSON.stringify(c) })
  const cambios = JSON.stringify(limpia) !== JSON.stringify(guardada)
  const poner = (p: Partial<ConfigRecomendaciones>) => { setC({ ...c, ...p }); setHecho(false) }

  async function guardar() {
    setGuardando(true); setError(null)
    try {
      await guardarAjusteWeb(CLAVE_RECOMENDACIONES, limpia)
      setC(limpia)
      await qc.invalidateQueries({ queryKey: ['textos-panel'] })
      qc.invalidateQueries({ queryKey: ['textos'] })
      setHecho(true)
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  const lista = qLista.data ?? []
  const premiadas = lista.filter(r => r.premiada).length

  return (
    <div className="p-5 space-y-4">
      <Volver />
      <div>
        <h1 className="text-[30px] leading-tight">Recomendaciones</h1>
        <p className="text-[14px] text-tinta-tenue mt-1">
          Cada clienta puede mandar a una amiga su enlace desde la página de su cita. Cuando la amiga viene por primera vez y
          marcas la cita como <b>completada</b>, las dos tienen su descuento para la próxima, sin que hagas nada.
        </p>
      </div>

      {qSql.data === false && (
        <Aviso tipo="aviso">
          Falta ejecutar en Supabase el SQL <b>recomendaciones_y_bonos.sql</b>: hasta entonces no se anotan ni se dan premios.
        </Aviso>
      )}

      <Tarjeta className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-[16px] font-semibold">Recomendaciones activas</div>
            <div className="text-[13px] text-tinta-tenue">
              {c.activa ? 'Las clientas ven «Recomienda a una amiga»' : 'Apagadas: nadie las ve'}
            </div>
          </div>
          <Interruptor activo={c.activa} onChange={v => poner({ activa: v })} etiqueta="Recomendaciones activas" />
        </div>

        <Porcentaje titulo="Para quien recomienda" desc="Descuento en su próxima cita"
                    valor={c.premio} onChange={v => poner({ premio: v })} />
        <Porcentaje titulo="Para la amiga" desc="Descuento en su segunda cita (0 = nada)"
                    valor={c.amiga} onChange={v => poner({ amiga: v })} />

        {error && <Aviso>{error}</Aviso>}
        <Boton ancho cargando={guardando} disabled={!cambios} onClick={guardar}>
          {hecho && !cambios ? '✓ Guardado' : 'Guardar'}
        </Boton>
      </Tarjeta>

      {qSql.data && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[19px] font-semibold">Quién trajo a quién</h2>
            {lista.length > 0 && <span className="text-[13px] text-tinta-tenue">{premiadas} de {lista.length} con premio</span>}
          </div>
          {qLista.isLoading && <Esqueleto className="h-24" />}
          {qLista.data && lista.length === 0 && (
            <p className="text-[14px] text-tinta-tenue px-1">Todavía ninguna. Aparecerán aquí cuando una amiga reserve con el enlace.</p>
          )}
          {lista.map(r => (
            <Tarjeta key={r.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0 text-[14px]">
                <Link to={`/panel/clientas/${r.quien_id}`} className="font-medium underline-offset-2 hover:underline">{r.quien_nombre}</Link>
                <span className="text-tinta-tenue"> trajo a </span>
                <Link to={`/panel/clientas/${r.id}`} className="font-medium underline-offset-2 hover:underline">{r.nombre}</Link>
              </div>
              <span className={`shrink-0 text-[12px] font-semibold ${r.premiada ? 'text-estado-exito' : 'text-tinta-tenue'}`}>
                {r.premiada ? '✓ Premiadas' : r.vino ? 'Sin premio' : 'Aún no vino'}
              </span>
            </Tarjeta>
          ))}
        </section>
      )}

      <p className="text-[13px] text-tinta-tenue px-1">
        El premio se apunta como «descuento para su próxima cita» en la ficha de cada una: lo puedes ver o quitar allí.
        Si ya tenía un descuento mayor, se queda el mayor. En la ficha también puedes apuntar a mano quién la recomendó.
      </p>
    </div>
  )
}

function Porcentaje({ titulo, desc, valor, onChange }: { titulo: string; desc: string; valor: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="text-[15px] font-medium">{titulo}</div>
        <div className="text-[13px] text-tinta-tenue">{desc}</div>
      </div>
      <input type="number" inputMode="numeric" min={0} max={100} step={5} value={valor} aria-label={titulo}
             onChange={e => onChange(Number(e.target.value))}
             className="w-16 min-h-[40px] rounded-lg border border-rosa-200 text-center text-[16px] font-semibold text-rosa-700" />
      <span className="text-[14px] text-tinta-suave">%</span>
    </div>
  )
}
