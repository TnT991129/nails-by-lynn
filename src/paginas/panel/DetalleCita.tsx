import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { citasEnRango, cambiarEstadoCita, actualizarNotaInterna } from '../../lib/panel/api-panel'
import { sb } from '../../lib/panel/supabase-panel'
import { Boton, Tarjeta, Pildora, Esqueleto, Aviso } from '../../componentes/ui'
import { fechaLarga, hora, duracion, dinero } from '../../lib/formato'
import BloqueMensajes from './BloqueMensajes'
import { mensajeDeError } from '../../lib/errores'
import { numeroWhatsApp } from '../../lib/panel/whatsapp'

export default function DetalleCita() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const [nota, setNota] = useState<string>('')
  const [notaCargada, setNotaCargada] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cargamos todas las citas de un rango amplio y filtramos, para reutilizar cache
  const q = useQuery({
    queryKey: ['cita-panel', id],
    queryFn: async () => {
      const d = new Date(); d.setMonth(d.getMonth() - 6)
      const f = new Date(); f.setMonth(f.getMonth() + 6)
      const filas = await citasEnRango(d.toISOString(), f.toISOString())
      const c = filas.find(x => x.id === id)
      if (!c) throw new Error('CITA_NO_ENCONTRADA')
      return c
    },
  })

  // Debe ir antes de cualquier return: los hooks siempre en el mismo orden
  const qToken = useQuery({
    queryKey: ['token-cita', id],
    queryFn: async () => {
      const { data, error } = await sb.from('appointments').select('access_token').eq('id', id).single()
      if (error) throw error
      return data.access_token as string
    },
    enabled: !!q.data,
  })

  if (q.data && !notaCargada) {
    setNota(q.data.internal_note ?? '')
    setNotaCargada(true)
  }

  async function cambiar(estado: 'CONFIRMADA'|'EN_CURSO'|'COMPLETADA'|'NO_SHOW'|'CANCELADA_NEGOCIO') {
    setTrabajando(true); setError(null)
    try {
      await cambiarEstadoCita(id, estado)
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

  return (
    <div className="p-5 space-y-4">
      <button onClick={() => navegar(-1)} className="text-tinta-suave min-h-[44px]">← Volver</button>

      <Tarjeta className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[14px] text-tinta-tenue">{c.code}</span>
          <Pildora estado={c.status} />
        </div>
        <div>
          <div className="text-[19px] font-semibold capitalize">{fechaLarga(c.starts_at)}</div>
          <div className="text-[16px]">{hora(c.starts_at)} – {hora(c.ends_at)}</div>
          <div className="text-[14px] text-tinta-tenue">{duracion(c.total_duration_minutes)}</div>
        </div>
        <hr className="border-rosa-100" />
        <div>
          <div className="text-[14px] text-tinta-tenue mb-1">Servicios</div>
          <div className="text-[16px]">{c.servicios}</div>
        </div>
        <hr className="border-rosa-100" />
        <div className="space-y-1 text-[14px]">
          <div className="flex justify-between"><span>Total</span><span>{dinero(Number(c.total_amount), c.currency)}</span></div>
          {Number(c.deposit_amount) > 0 && <>
            <div className="flex justify-between"><span>Anticipo</span><span>{dinero(Number(c.deposit_amount), c.currency)}</span></div>
            <div className="flex justify-between font-medium"><span>Saldo</span><span>{dinero(Number(c.balance_due), c.currency)}</span></div>
          </>}
        </div>
      </Tarjeta>

      <Tarjeta className="space-y-2">
        <div className="text-[14px] text-tinta-tenue">Clienta</div>
        <div className="text-[16px] font-medium">{c.cliente_nombre}</div>
        <a href={`https://wa.me/${numeroWhatsApp(c.cliente_telefono)}`}
           target="_blank" rel="noreferrer"
           className="text-rosa-800 underline text-[14px] min-h-[44px] inline-flex items-center">
          {c.cliente_telefono} · Escribir por WhatsApp
        </a>
        {c.client_note && (
          <div className="mt-2 pt-2 border-t border-rosa-100">
            <div className="text-[12px] text-tinta-tenue mb-1">Nota de la clienta</div>
            <div className="text-[14px]">{c.client_note}</div>
          </div>
        )}
      </Tarjeta>

      {qToken.data && <BloqueMensajes cita={c} tokenAcceso={qToken.data} />}

      {error && <Aviso>{error}</Aviso>}

      {activa && (
        <div className="space-y-2">
          <div className="text-[14px] text-tinta-tenue">Cambiar estado</div>
          <div className="grid grid-cols-2 gap-2">
            {c.status === 'PENDIENTE' && (
              <Boton variante="secundario" onClick={() => cambiar('CONFIRMADA')} cargando={trabajando}>
                Confirmar
              </Boton>
            )}
            {(c.status === 'PENDIENTE' || c.status === 'CONFIRMADA') && (
              <Boton variante="secundario" onClick={() => cambiar('EN_CURSO')} cargando={trabajando}>
                En curso
              </Boton>
            )}
            <Boton onClick={() => cambiar('COMPLETADA')} cargando={trabajando}
                   className={c.status === 'PENDIENTE' ? '' : 'col-span-2'}>
              Completada
            </Boton>
            <Boton variante="peligro" onClick={() => cambiar('NO_SHOW')} cargando={trabajando}>
              No asistió
            </Boton>
            <Boton variante="peligro" onClick={() => cambiar('CANCELADA_NEGOCIO')}
                   cargando={trabajando}>
              Cancelar cita
            </Boton>
          </div>
        </div>
      )}

      <Tarjeta className="space-y-2">
        <label className="block text-[14px] text-tinta-tenue">Nota de esta cita</label>
        <textarea value={nota} onChange={e => setNota(e.target.value)} rows={3}
          placeholder="Ej: trajo su propio esmalte, necesita salir a las 4…"
          className="w-full px-3 py-2 rounded-sm border border-rosa-200 text-[16px]" />
        <Boton variante="secundario" onClick={guardarNota} cargando={trabajando}>
          Guardar nota
        </Boton>
      </Tarjeta>
    </div>
  )
}
