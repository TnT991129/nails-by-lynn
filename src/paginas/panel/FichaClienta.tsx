import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerClienta, citasDeClienta, actualizarNotasInternas, bloquearClienta,
  resumenHistorialClienta, eliminarClientaConHistorial } from '../../lib/panel/api-panel'
import { Boton, Tarjeta, Pildora, Esqueleto, Aviso } from '../../componentes/ui'
import { fechaLarga, hora, dinero } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'

export default function FichaClienta() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const [notas, setNotas] = useState('')
  const [cargada, setCargada] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [errorGestion, setErrorGestion] = useState<string | null>(null)

  const qCli = useQuery({ queryKey:['cli', id], queryFn: () => obtenerClienta(id) })
  const qCitas = useQuery({ queryKey:['cli-citas', id], queryFn: () => citasDeClienta(id) })
  const qHist = useQuery({
    queryKey: ['cli-historial', id],
    queryFn: () => resumenHistorialClienta(id),
    enabled: confirmarBorrado,
  })

  if (qCli.data && !cargada) {
    setNotas(qCli.data.internal_notes ?? '')
    setCargada(true)
  }

  async function guardar() {
    setGuardando(true); setError(null)
    try {
      await actualizarNotasInternas(id, notas)
      qc.invalidateQueries({ queryKey:['cli', id] })
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  async function alternarBloqueo(bloqueada: boolean) {
    setTrabajando(true); setErrorGestion(null)
    try {
      await bloquearClienta(id, bloqueada)
      qc.invalidateQueries({ queryKey: ['cli', id] })
      qc.invalidateQueries({ queryKey: ['clientas'] })
    } catch (e) { setErrorGestion(mensajeDeError(e)) }
    finally { setTrabajando(false) }
  }

  async function eliminar() {
    setTrabajando(true); setErrorGestion(null)
    try {
      await eliminarClientaConHistorial(id)
      qc.invalidateQueries()  // cambian agenda y estadísticas
      navegar('/panel/clientas', { replace: true })
    } catch (e) { setErrorGestion(mensajeDeError(e)) }
    finally { setTrabajando(false) }
  }

  if (qCli.isLoading) return <div className="p-5"><Esqueleto className="h-48" /></div>
  if (qCli.isError) return <div className="p-5"><Aviso>{mensajeDeError(qCli.error)}</Aviso></div>

  const c = qCli.data!
  const h = qHist.data
  const proxima = qCitas.data?.find(x =>
    ['CONFIRMADA','PENDIENTE'].includes(x.status) &&
    new Date(x.starts_at).getTime() > Date.now())

  return (
    <div className="p-5 space-y-4">
      <button onClick={() => navegar(-1)} className="text-tinta-suave min-h-[44px]">← Volver</button>

      <div>
        <div className="flex items-start justify-between gap-2">
          <h1 className="font-display text-[24px]">{c.full_name}</h1>
          <Link to={`/panel/clientas/${c.id}/editar`}
            className="min-h-[44px] px-3 inline-flex items-center text-rosa-800 underline text-[14px] shrink-0">
            Editar
          </Link>
        </div>
        {c.is_blocked && (
          <div className="text-[13px] text-estado-error">Bloqueada: no puede reservar desde la web</div>
        )}
        <a href={`https://wa.me/${c.phone.replace(/[^0-9]/g,'')}`} target="_blank" rel="noreferrer"
           className="text-rosa-800 underline text-[14px] min-h-[44px] inline-flex items-center">
          {c.phone} · WhatsApp
        </a>
        {c.instagram && <div className="text-[14px] text-tinta-tenue">@{c.instagram.replace(/^@/,'')}</div>}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Tarjeta className="py-3">
          <div className="text-[11px] uppercase tracking-wider text-tinta-tenue">Citas</div>
          <div className="font-display text-[24px]">{c.total_appointments}</div>
        </Tarjeta>
        <Tarjeta className="py-3">
          <div className="text-[11px] uppercase tracking-wider text-tinta-tenue">Gasto</div>
          <div className="font-display text-[20px]">{dinero(Number(c.total_spent_cup))}</div>
        </Tarjeta>
        <Tarjeta className="py-3">
          <div className="text-[11px] uppercase tracking-wider text-tinta-tenue">No-show</div>
          <div className="font-display text-[24px]">{c.total_no_shows}</div>
        </Tarjeta>
      </div>

      {proxima && (
        <Tarjeta className="bg-rosa-50 border border-rosa-200">
          <div className="text-[12px] tracking-wider uppercase text-tinta-tenue">Próxima cita</div>
          <div className="text-[16px] mt-1 capitalize">
            {fechaLarga(proxima.starts_at)} · <span className="normal-case">{hora(proxima.starts_at)}</span>
          </div>
          <div className="text-[14px] text-tinta-suave">{proxima.servicios}</div>
        </Tarjeta>
      )}

      <Tarjeta className="space-y-2">
        <label className="block text-[14px] text-tinta-tenue">Sobre esta clienta</label>
        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={4}
          placeholder="Alergias, preferencias, cómo prefiere que la trates…"
          className="w-full px-3 py-2 rounded-sm border border-rosa-200 text-[16px]" />
        {error && <Aviso>{error}</Aviso>}
        <Boton variante="secundario" onClick={guardar} cargando={guardando}>Guardar notas</Boton>
      </Tarjeta>

      <section>
        <h2 className="text-[19px] font-semibold mb-3">Historial</h2>
        {qCitas.isLoading && <Esqueleto className="h-16" />}
        {qCitas.data && qCitas.data.length === 0 && (
          <p className="text-tinta-tenue text-[14px]">Sin citas todavía.</p>
        )}
        <div className="space-y-2">
          {qCitas.data?.map(x => (
            <Link key={x.id} to={`/panel/cita/${x.id}`} className="block">
              <Tarjeta className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[14px] capitalize">
                    {fechaLarga(x.starts_at)} · <span className="normal-case">{hora(x.starts_at)}</span>
                  </div>
                  <div className="text-[12px] text-tinta-tenue truncate">{x.servicios}</div>
                </div>
                <Pildora estado={x.status} />
              </Tarjeta>
            </Link>
          ))}
        </div>
      </section>

      <Tarjeta className="space-y-2">
        <div className="text-[14px] text-tinta-tenue">Gestionar clienta</div>
        {errorGestion && <Aviso>{errorGestion}</Aviso>}
        <Boton variante="secundario" ancho cargando={trabajando}
          onClick={() => alternarBloqueo(!c.is_blocked)}>
          {c.is_blocked ? 'Desbloquear clienta' : 'Bloquear clienta'}
        </Boton>
        {!confirmarBorrado ? (
          <Boton variante="peligro" ancho onClick={() => { setConfirmarBorrado(true); setErrorGestion(null) }}>
            Eliminar clienta
          </Boton>
        ) : (
          <div className="p-3 rounded-sm border border-rosa-200 bg-rosa-50 space-y-2">
            {qHist.isLoading && <Esqueleto className="h-12" />}
            {qHist.isError && <Aviso>{mensajeDeError(qHist.error)}</Aviso>}
            {h && (h.activas > 0 ? (
              <p className="text-[14px]">
                Tiene {h.activas} {h.activas === 1 ? 'cita pendiente' : 'citas pendientes'}.
                Cancélalas primero para poder eliminarla.
              </p>
            ) : h.citas > 0 ? (
              <p className="text-[14px]">
                ⚠️ Tiene <b>{h.citas} {h.citas === 1 ? 'cita' : 'citas'}</b> en su historial
                {h.completadas > 0 && <> (<b>{h.completadas} {h.completadas === 1 ? 'completada' : 'completadas'}
                {h.ingresos > 0 && `, ${dinero(h.ingresos)}`}</b>)</>}.
                Si la eliminas se borrará todo y esos ingresos dejarán de contar en Estadísticas.
                No se puede deshacer.
              </p>
            ) : (
              <p className="text-[14px]">Se eliminará esta clienta. No se puede deshacer.</p>
            ))}
            {h && h.activas === 0 && (
              <Boton variante="peligro" ancho cargando={trabajando} onClick={eliminar}>
                {h.citas > 0 ? 'Borrar clienta y su historial' : 'Sí, eliminar'}
              </Boton>
            )}
            <Boton variante="secundario" ancho onClick={() => setConfirmarBorrado(false)}>
              Cancelar
            </Boton>
          </div>
        )}
      </Tarjeta>
    </div>
  )
}
