import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  obtenerTextosPanel, ajustarSellos, excluirDeFidelidad, darTarjetaFidelidad, aplicarDescuento, type Cliente,
} from '../../lib/panel/api-panel'
import { leerFidelidad, tamanoTarjeta, sellosEnTarjeta, premioAlLlegar, siguientePremio, participa } from '../../lib/fidelidad'
import { Tarjeta, Aviso } from '../../componentes/ui'
import { mensajeDeError } from '../../lib/errores'

// La tarjeta de una clienta en su ficha: cuántos sellos lleva, sumar o quitar sellos a mano
// (p. ej. clientas de antes de la web) y, según para quién sea la tarjeta, sacarla o darle la tarjeta.
export default function FidelidadClienta({ clienta }: { clienta: Cliente }) {
  const qc = useQueryClient()
  const qCfg = useQuery({ queryKey: ['textos-panel'], queryFn: obtenerTextosPanel })
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cfg = leerFidelidad(qCfg.data)
  if (!qCfg.data) return null
  if (!cfg.activa) {
    return (
      <p className="text-[13px] text-tinta-tenue px-1">
        La tarjeta de fidelidad está apagada. <Link to="/panel/fidelidad" className="underline text-rosa-800">Activarla</Link>
      </p>
    )
  }

  const elegidas = cfg.modo === 'elegidas'
  // «Solo las que yo elija» necesita la columna de fidelidad_elegidas.sql
  const sinSql = clienta.loyalty_adjustment === undefined || (elegidas && clienta.loyalty_enrolled === undefined)
  const ajuste = clienta.loyalty_adjustment ?? 0
  const fuera = !participa(cfg, clienta)
  const sellos = Math.max(0, clienta.total_appointments + ajuste)
  const tamano = tamanoTarjeta(cfg)
  const llenos = sellosEnTarjeta(cfg, sellos)
  const siguiente = siguientePremio(cfg, sellos)
  const nombre = clienta.full_name.trim().split(/\s+/)[0]

  function refrescar() {
    qc.invalidateQueries({ queryKey: ['cli', clienta.id] })
    qc.invalidateQueries({ queryKey: ['clientas'] })
  }

  async function cambiarSellos(paso: 1 | -1) {
    if (paso === -1 && sellos === 0) return
    setTrabajando(true); setError(null)
    try {
      await ajustarSellos(clienta.id, ajuste + paso)
      // Si con este sello llega a un premio, se le puede dar ya (igual que al completar una cita)
      const premio = paso === 1 ? premioAlLlegar(cfg, sellos + 1) : null
      if (premio && confirm(`Con este sello ${nombre} llega a ${premio.citas} ${premio.citas === 1 ? 'cita' : 'citas'}.\n¿Le dejas ya su ${premio.premio}% de descuento para la próxima cita?`)) {
        await aplicarDescuento(clienta.id, Math.max(premio.premio, Number(clienta.next_discount_percent ?? 0)), 'Premio de la tarjeta de fidelidad')
      }
      refrescar()
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setTrabajando(false) }
  }

  async function alternarFuera() {
    setTrabajando(true); setError(null)
    try {
      if (elegidas) await darTarjetaFidelidad(clienta.id, fuera)
      else await excluirDeFidelidad(clienta.id, !fuera)
      refrescar()
      qc.invalidateQueries({ queryKey: ['clientas-con-tarjeta'] })
    }
    catch (e) { setError(mensajeDeError(e)) }
    finally { setTrabajando(false) }
  }

  return (
    <Tarjeta className={`space-y-3 transition-opacity ${fuera ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold">Tarjeta de fidelidad</div>
          <div className="text-[13px] text-tinta-tenue">
            {fuera ? (elegidas ? 'No tiene tarjeta: no la ve ni gana premios.' : 'No participa: no ve la tarjeta ni gana premios.')
              : siguiente ? `${sellos} ${sellos === 1 ? 'sello' : 'sellos'} · le ${siguiente.faltan === 1 ? 'falta 1 cita' : `faltan ${siguiente.faltan} citas`} para su ${siguiente.nivel.premio}%`
              : `${sellos} sellos · completó la tarjeta`}
          </div>
        </div>
        <span aria-hidden className="text-[22px]">💅</span>
      </div>

      {!fuera && (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(tamano, 10)}, minmax(0, 1fr))` }}>
          {Array.from({ length: tamano }).map((_, i) => {
            const nivel = cfg.niveles.find(n => n.citas === i + 1)
            return (
              <span key={i} title={nivel ? `${nivel.premio}% al llegar aquí` : undefined}
                className={`aspect-square rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition
                  ${i < llenos ? 'bg-rosa-600 border-rosa-600 text-white' : nivel ? 'border-rosa-400 text-rosa-700 border-dashed' : 'border-rosa-200'}`}>
                {i < llenos ? '★' : nivel ? `${nivel.premio}%` : ''}
              </span>
            )
          })}
        </div>
      )}

      {sinSql ? (
        <Aviso tipo="aviso">
          Para sumar sellos a mano o {elegidas ? 'dar la tarjeta a una clienta' : 'sacar a una clienta de la tarjeta'}, falta ejecutar en
          Supabase <b>{clienta.loyalty_adjustment === undefined ? 'fidelidad_niveles.sql' : 'fidelidad_elegidas.sql'}</b>.
        </Aviso>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {!fuera && <>
            <button onClick={() => cambiarSellos(-1)} disabled={trabajando || sellos === 0}
              className="min-h-[40px] px-3 rounded-boton border border-rosa-200 text-[14px] font-medium disabled:opacity-40">− Quitar sello</button>
            <button onClick={() => cambiarSellos(1)} disabled={trabajando}
              className="min-h-[40px] px-3 rounded-boton border border-rosa-300 bg-rosa-50 text-rosa-800 text-[14px] font-semibold disabled:opacity-40">+ Sumar sello</button>
          </>}
          {elegidas && fuera ? (
            <button onClick={alternarFuera} disabled={trabajando}
              className="min-h-[40px] px-4 rounded-boton bg-rosa-600 text-white text-[14px] font-semibold disabled:opacity-40">
              + Darle la tarjeta
            </button>
          ) : (
            <button onClick={alternarFuera} disabled={trabajando} className="ml-auto text-[13px] text-tinta-tenue underline min-h-[40px]">
              {elegidas ? 'Quitarle la tarjeta' : fuera ? 'Volver a incluirla' : 'Sacarla de la tarjeta'}
            </button>
          )}
        </div>
      )}
      {!sinSql && ajuste !== 0 && (
        <p className="text-[12px] text-tinta-tenue">
          {clienta.total_appointments} {clienta.total_appointments === 1 ? 'cita completada' : 'citas completadas'} {ajuste > 0 ? '+' : '−'} {Math.abs(ajuste)} {Math.abs(ajuste) === 1 ? 'sello puesto' : 'sellos puestos'} a mano
        </p>
      )}
      {error && <Aviso>{error}</Aviso>}
    </Tarjeta>
  )
}
