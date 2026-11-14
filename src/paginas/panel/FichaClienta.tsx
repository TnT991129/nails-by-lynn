import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerClienta, citasDeClienta, actualizarNotasInternas, bloquearClienta, contadoresClientas,
  resumenHistorialClienta, eliminarClientaConHistorial } from '../../lib/panel/api-panel'
import { Boton, Tarjeta, Pildora, Esqueleto, Aviso, estiloBoton } from '../../componentes/ui'
import { IconoWhatsApp } from '../../componentes/iconos'
import { Cabecera, Seccion, Cifras, Plegable, FilaCita } from './piezas'
import { fechaLarga, hora, dinero, importe } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'
import { ListaServicios } from './comunes'
import DescuentoClienta from './DescuentoClienta'
import FidelidadClienta from './FidelidadClienta'
import RecomendacionClienta from './RecomendacionClienta'
import AvisoAlergias from './AvisoAlergias'
import FotosTrabajo from './FotosTrabajo'

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
  const qCont = useQuery({ queryKey: ['contadores-clientas'], queryFn: contadoresClientas })
  const qHist = useQuery({
    queryKey: ['cli-historial', id],
    queryFn: () => resumenHistorialClienta(id),
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
  // La lista viene de la más nueva a la más vieja: la próxima es la última que cumple
  const proxima = qCitas.data?.slice().reverse().find(x =>
    ['CONFIRMADA','PENDIENTE'].includes(x.status) &&
    new Date(x.starts_at).getTime() > Date.now())

  const cont = qCont.data?.[c.id]
  const cumple = c.birthday && new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(c.birthday + 'T12:00:00Z'))

  return (
    <div className="p-5 space-y-6">
      <Cabecera volver titulo={c.full_name}
        accion={<Link to={`/panel/clientas/${c.id}/editar`} className={`${estiloBoton('secundario')} !min-h-[40px] !px-4 !text-[14px]`}>Editar</Link>}
        apoyo={c.is_blocked ? <span className="text-estado-error">Bloqueada: no puede reservar desde la web</span> : undefined} />

      {/* Contacto */}
      <div className="flex flex-wrap gap-2">
        <a href={`https://wa.me/${c.phone.replace(/[^0-9]/g,'')}`} target="_blank" rel="noreferrer"
           className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-full bg-whatsapp text-white text-[14px] font-semibold">
          <IconoWhatsApp tam={16} /> {c.phone}
        </a>
        {c.instagram && (
          <span className="inline-flex items-center min-h-[40px] px-3 rounded-full bg-papel border border-rosa-100 text-[13px] text-tinta-suave">
            @{c.instagram.replace(/^@/,'')}
          </span>
        )}
        {cumple && (
          <span className="inline-flex items-center min-h-[40px] px-3 rounded-full bg-papel border border-rosa-100 text-[13px] text-tinta-suave">
            🎂 {cumple}
          </span>
        )}
      </div>

      <AvisoAlergias texto={c.allergies} />

      <Cifras datos={[
        { etiqueta: 'Citas', valor: cont?.citas ?? c.total_appointments },
        { etiqueta: 'Gastado', valor: h ? importe(h.ingresos) : '…' },
        { etiqueta: 'No vino', valor: cont?.noAsistio ?? c.total_no_shows, tono: (cont?.noAsistio ?? c.total_no_shows) > 0 ? 'error' : 'normal' },
        { etiqueta: 'Canceló', valor: cont?.canceladas ?? c.total_cancellations, apoyo: cont?.reagendadas ? `${cont.reagendadas} cambios` : undefined },
      ]} />

      {proxima && (
        <Seccion titulo="Próxima cita">
          <FilaCita cita={proxima} extra={<div className="text-[12px] text-tinta-tenue mt-1 first-letter:uppercase">{fechaLarga(proxima.starts_at)}</div>} />
        </Seccion>
      )}

      <Seccion titulo="Premios y descuentos">
        <div className="space-y-3">
          <DescuentoClienta clienta={c} proxima={proxima} />
          <FidelidadClienta clienta={c} />
          <RecomendacionClienta clienta={c} />
        </div>
      </Seccion>

      <Seccion titulo="Notas y diseños">
        <Tarjeta className="space-y-2">
          <label htmlFor="notas-clienta" className="block text-[14px] font-medium text-tinta-suave">Sobre esta clienta</label>
          <textarea id="notas-clienta" value={notas} onChange={e => setNotas(e.target.value)} rows={3}
            placeholder="Preferencias, cómo prefiere que la trates…"
            className="w-full px-3 py-2 rounded-lg border border-rosa-200 text-[16px]" />
          {error && <Aviso>{error}</Aviso>}
          <Boton variante="secundario" onClick={guardar} cargando={guardando} className="!min-h-[44px]">Guardar notas</Boton>
        </Tarjeta>
        <FotosTrabajo clientId={c.id} />
      </Seccion>

      <Seccion titulo="Historial" extra={qCitas.data?.length ? `${qCitas.data.length} ${qCitas.data.length === 1 ? 'cita' : 'citas'}` : undefined}>
        {qCitas.isLoading && <Esqueleto className="h-16" />}
        {qCitas.data && qCitas.data.length === 0 && (
          <p className="text-tinta-tenue text-[14px] px-1">Sin citas todavía.</p>
        )}
        {qCitas.data && qCitas.data.length > 0 && (
          <Tarjeta className="!p-0 divide-y divide-rosa-100 overflow-hidden">
            {qCitas.data.map(x => (
              <Link key={x.id} to={`/panel/cita/${x.id}`} className="flex items-center justify-between gap-2 px-4 py-3 active:bg-rosa-50">
                {/* min-w-0 + break-words: los textos largos bajan de línea en vez de salirse */}
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium first-letter:uppercase break-words">
                    {fechaLarga(x.starts_at)} · <span className="normal-case">{hora(x.starts_at)}</span>
                  </div>
                  <ListaServicios texto={x.servicios} className="text-[12px] text-tinta-tenue" />
                </div>
                <div className="shrink-0"><Pildora estado={x.status} /></div>
              </Link>
            ))}
          </Tarjeta>
        )}
      </Seccion>

      <Plegable titulo="Gestionar clienta" resumen="Bloquear o eliminar" abierto={confirmarBorrado}>
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
          <div className="p-3 rounded-lg border border-rosa-200 bg-rosa-50 space-y-2">
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
      </Plegable>
    </div>
  )
}
