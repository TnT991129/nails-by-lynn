import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerCitaPanel, cambiarEstadoCita, actualizarNotaInterna, obtenerClienta } from '../../lib/panel/api-panel'
import { sb } from '../../lib/panel/supabase-panel'
import { Boton, Tarjeta, Pildora, Esqueleto, Aviso } from '../../componentes/ui'
import { fechaLarga, hora, duracion, dinero, precioRango } from '../../lib/formato'
import BloqueMensajes from './BloqueMensajes'
import ReagendarCita from './ReagendarCita'
import AvisoCancelacion from './AvisoCancelacion'
import { mensajeDeError } from '../../lib/errores'
import { numeroWhatsApp } from '../../lib/panel/whatsapp'
import { ListaServicios } from './comunes'
import { Cabecera, Seccion, Plegable } from './piezas'
import { IconoCalendario, IconoWhatsApp } from '../../componentes/iconos'
import EnCup from '../../componentes/EnCup'
import DescuentoCita from './DescuentoCita'
import AvisoAlergias from './AvisoAlergias'
import CobroCita from './CobroCita'
import EsperaDelDia from './EsperaDelDia'
import MensajeGracias from './MensajeGracias'
import FotosTrabajo from './FotosTrabajo'
import EditarServiciosCita from './EditarServiciosCita'
import InspiracionPanel from './InspiracionPanel'

export default function DetalleCita() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const [nota, setNota] = useState<string>('')
  const [notaCargada, setNotaCargada] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reagendando, setReagendando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [motivo, setMotivo] = useState('')

  const q = useQuery({
    queryKey: ['cita-panel', id],
    queryFn: () => obtenerCitaPanel(id),
  })

  // Debe ir antes de cualquier return: los hooks siempre en el mismo orden
  const qToken = useQuery({
    queryKey: ['token-cita', id],
    queryFn: async () => {
      const { data, error } = await sb.from('appointments')
        .select('access_token, cancellation_reason').eq('id', id).single()
      if (error) throw error
      return { token: data.access_token as string, motivo: data.cancellation_reason as string | null }
    },
    enabled: !!q.data,
  })

  // Ficha de la clienta: para avisar de sus alergias
  const qCli = useQuery({
    queryKey: ['cli', q.data?.client_id],
    queryFn: () => obtenerClienta(q.data!.client_id),
    enabled: !!q.data?.client_id,
  })

  if (q.data && !notaCargada) {
    setNota(q.data.internal_note ?? '')
    setNotaCargada(true)
  }

  async function cambiar(estado: 'CONFIRMADA'|'EN_CURSO'|'COMPLETADA'|'NO_SHOW'|'CANCELADA_NEGOCIO') {
    setTrabajando(true); setError(null)
    try {
      await cambiarEstadoCita(id, estado, estado === 'CANCELADA_NEGOCIO' ? motivo.trim() || undefined : undefined)
      setCancelando(false)
      qc.invalidateQueries()
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setTrabajando(false) }
  }

  async function guardarNota() {
    setTrabajando(true); setError(null)
    try {
      await actualizarNotaInterna(id, nota)
      qc.invalidateQueries({ queryKey: ['cita-panel', id] })
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setTrabajando(false) }
  }

  if (q.isLoading) return <div className="p-5"><Esqueleto className="h-48" /></div>
  if (q.isError) return <div className="p-5"><Aviso>{mensajeDeError(q.error)}</Aviso></div>

  const c = q.data!
  const activa = ['PENDIENTE','CONFIRMADA','EN_CURSO'].includes(c.status)
  const cancelada = ['CANCELADA_CLIENTA', 'CANCELADA_NEGOCIO'].includes(c.status)
  // El botón grande: lo que normalmente toca después
  const siguiente: { estado: 'CONFIRMADA' | 'EN_CURSO' | 'COMPLETADA'; texto: string } | null =
    c.status === 'PENDIENTE' ? { estado: 'CONFIRMADA', texto: 'Confirmar cita' }
    : c.status === 'CONFIRMADA' ? { estado: 'EN_CURSO', texto: 'Empezar' }
    : c.status === 'EN_CURSO' ? { estado: 'COMPLETADA', texto: '✓ Terminada' }
    : null

  return (
    <div className="p-5 space-y-6">
      <Cabecera volver titulo={c.cliente_nombre} sobre={c.code} accion={<Pildora estado={c.status} />} />

      <AvisoAlergias texto={qCli.data?.allergies} />

      {/* La cita de un vistazo */}
      <Tarjeta className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[18px] font-semibold first-letter:uppercase">{fechaLarga(c.starts_at)}</div>
            <div className="text-[15px] text-tinta-suave">{hora(c.starts_at)} – {hora(c.ends_at)} · {duracion(c.total_duration_minutes)}</div>
          </div>
          <a href={`https://wa.me/${numeroWhatsApp(c.cliente_telefono)}`} target="_blank" rel="noreferrer" aria-label="Escribirle por WhatsApp"
             className="shrink-0 w-11 h-11 rounded-full bg-whatsapp text-white flex items-center justify-center">
            <IconoWhatsApp tam={20} />
          </a>
        </div>
        <ListaServicios texto={c.servicios} className="text-[15px]" />
        <div className="space-y-1 text-[14px] pt-3 border-t border-rosa-100">
          {Number(c.discount_amount ?? 0) > 0 && (
            <div className="flex justify-between text-estado-exito">
              <span>Descuento ({Number(c.discount_percent)}%)</span>
              <span>−{dinero(Number(c.discount_amount))}</span>
            </div>
          )}
          <div className="flex justify-between"><span className="text-tinta-suave">Precio estimado</span><span className="text-right font-semibold">{precioRango(Number(c.total_amount), c.total_amount_max)}<EnCup min={Number(c.total_amount)} max={c.total_amount_max} /></span></div>
          {Number(c.deposit_amount) > 0 && <>
            <div className="flex justify-between"><span>Anticipo</span><span>{dinero(Number(c.deposit_amount))}</span></div>
            <div className="flex justify-between font-medium"><span>Saldo</span><span>{dinero(Number(c.balance_due))}</span></div>
          </>}
        </div>
        {c.client_note && (
          <div className="rounded-lg bg-rosa-50 px-3 py-2.5">
            <div className="text-[12px] text-tinta-tenue mb-0.5">Nota de la clienta</div>
            <div className="text-[14px]">{c.client_note}</div>
          </div>
        )}
        <Link to={`/panel/clientas/${c.client_id}`} className="inline-flex items-center min-h-[36px] text-[14px] font-semibold text-rosa-800">
          Ver ficha de {c.cliente_nombre.trim().split(/\s+/)[0]} ›
        </Link>
      </Tarjeta>

      {error && <Aviso>{error}</Aviso>}

      {/* Qué hacer con la cita */}
      {activa && !editando && !reagendando && !cancelando && (
        <div className="space-y-2">
          {siguiente && (
            <Boton ancho onClick={() => cambiar(siguiente.estado)} cargando={trabajando}>{siguiente.texto}</Boton>
          )}
          {c.status === 'EN_CURSO' ? null : (
            <Boton ancho variante="secundario" onClick={() => cambiar('COMPLETADA')} cargando={trabajando}>Marcar como terminada</Boton>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={() => setEditando(true)} className="!min-h-[46px] !text-[14px]">✏️ Servicios</Boton>
            <Boton variante="secundario" onClick={() => setReagendando(true)} className="!min-h-[46px] !text-[14px]"><IconoCalendario tam={16} /> Reagendar</Boton>
            <Boton variante="peligro" onClick={() => cambiar('NO_SHOW')} cargando={trabajando} className="!min-h-[46px] !text-[14px]">No vino</Boton>
            <Boton variante="peligro" onClick={() => setCancelando(true)} className="!min-h-[46px] !text-[14px]">Cancelar</Boton>
          </div>
        </div>
      )}
      {activa && editando && <EditarServiciosCita cita={c} onCerrar={() => setEditando(false)} />}
      {activa && reagendando && (
        <ReagendarCita cita={c} tokenAcceso={qToken.data?.token} onCerrar={() => setReagendando(false)} />
      )}
      {activa && cancelando && (
        <Tarjeta className="space-y-3 border border-estado-error/40 animate-entrada">
          <div className="text-[16px] font-semibold">¿Cancelar la cita de {c.cliente_nombre.trim().split(/\s+/)[0]}?</div>
          <label className="block">
            <span className="block text-[14px] text-tinta-suave mb-1.5">
              Motivo (opcional, va en el mensaje a la clienta)
            </span>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2}
              placeholder="Ej: me surgió un imprevisto de salud"
              className="w-full px-3 py-2 rounded-lg border border-rosa-200 text-[16px] bg-papel
                         focus:outline-none focus:ring-4 focus:ring-rosa-100 focus:border-rosa-500" />
          </label>
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={() => setCancelando(false)} className="flex-1">No, volver</Boton>
            <Boton variante="peligro" onClick={() => cambiar('CANCELADA_NEGOCIO')} cargando={trabajando}
                   className="flex-1">Sí, cancelar</Boton>
          </div>
          <p className="text-[12px] text-tinta-tenue">Después podrás avisarle por WhatsApp con un toque.</p>
        </Tarjeta>
      )}

      {!cancelada && (
        <Seccion titulo="Cobro">
          {['CONFIRMADA', 'EN_CURSO', 'COMPLETADA', 'PENDIENTE'].includes(c.status) && <CobroCita cita={c} />}
          <DescuentoCita cita={c} />
        </Seccion>
      )}

      <Seccion titulo="Mensajes">
        <div className="space-y-3 empty:hidden peer">
          {activa && qToken.data && <BloqueMensajes cita={c} tokenAcceso={qToken.data.token} />}
          {c.status === 'COMPLETADA' && qToken.data && <MensajeGracias cita={c} tokenAcceso={qToken.data.token} />}
          {c.status === 'CANCELADA_NEGOCIO' && qToken.data && (
            <AvisoCancelacion cita={c} tokenAcceso={qToken.data.token} motivo={qToken.data.motivo} />
          )}
          {cancelada && <EsperaDelDia inicio={c.starts_at} />}
        </div>
        <p className="hidden peer-empty:block text-[14px] text-tinta-tenue px-1">Nada que mandar ahora.</p>
      </Seccion>

      <Seccion titulo="Fotos y notas">
        <InspiracionPanel citaId={c.id} />
        {['EN_CURSO', 'COMPLETADA'].includes(c.status) && <FotosTrabajo clientId={c.client_id} titulo="Foto del trabajo" />}
        <Plegable titulo="Nota de esta cita" resumen={c.internal_note || 'Solo la ves tú'} abierto={!!c.internal_note}>
          <textarea value={nota} onChange={e => setNota(e.target.value)} rows={3}
            placeholder="Ej: trajo su propio esmalte, necesita salir a las 4…"
            className="w-full px-3 py-2 rounded-lg border border-rosa-200 text-[16px]" />
          <Boton variante="secundario" onClick={guardarNota} cargando={trabajando} className="!min-h-[44px]">Guardar nota</Boton>
        </Plegable>
      </Seccion>

      {/* Un toque por error en «Completada» o «No asistió» se puede deshacer (los contadores se corrigen solos) */}
      {['COMPLETADA', 'NO_SHOW'].includes(c.status) && (
        <button onClick={() => { if (confirm('¿Volver a dejar la cita como confirmada?')) cambiar('CONFIRMADA') }}
                disabled={trabajando}
                className="w-full min-h-[44px] text-[14px] text-tinta-suave underline underline-offset-2 disabled:opacity-60">
          ↩ Deshacer «{c.status === 'COMPLETADA' ? 'Completada' : 'No asistió'}»
        </button>
      )}
    </div>
  )
}
