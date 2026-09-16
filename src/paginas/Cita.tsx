import { useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerCita, cancelarCita } from '../lib/api'
import { Boton, Tarjeta, Pildora, Esqueleto, Aviso } from '../componentes/ui'
import { fechaLarga, hora, duracion, dinero } from '../lib/formato'
import { mensajeDeError } from '../lib/errores'
import { olvidarToken } from '../lib/almacenamiento'

export default function Cita() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const esNueva = params.get('nueva') === '1'
  const qc = useQueryClient()
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  const q = useQuery({ queryKey:['cita', token], queryFn: () => obtenerCita(token) })

  async function cancelar() {
    setTrabajando(true); setError(null)
    try {
      await cancelarCita(token)
      olvidarToken(token)
      setConfirmando(false)
      qc.invalidateQueries({ queryKey:['cita', token] })
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setTrabajando(false) }
  }

  if (q.isLoading) return <div className="p-5 space-y-3"><Esqueleto className="h-48" /></div>
  if (q.isError) return <div className="p-5"><Aviso>{mensajeDeError(q.error)}</Aviso></div>

  const c = q.data!
  const activa = c.estado === 'CONFIRMADA' || c.estado === 'PENDIENTE'

  return (
    <div className="pb-24">
      {esNueva && (
        <section className="px-5 pt-14 pb-10 text-center"
          style={{ background:'radial-gradient(ellipse at 50% 45%, #EE4397 0%, #FBA2D0 45%, #FEF2F8 75%, #FFFFFF 100%)' }}>
          <div className="w-16 h-16 rounded-full bg-rosa-600 text-white text-[28px]
                          flex items-center justify-center mx-auto mb-5 animate-entrada">✓</div>
          <h1 className="font-display text-[30px]">¡Tu cita está confirmada! 💗</h1>
        </section>
      )}

      <div className="px-5 pt-6 space-y-4">
        <Tarjeta className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[14px] text-tinta-tenue">{c.code}</span>
            <Pildora estado={c.estado} />
          </div>
          <div>
            {c.servicios?.map((s, i) => (
              <div key={i} className="flex justify-between text-[16px]">
                <span>{s.nombre}</span><span>{dinero(Number(s.precio), c.moneda)}</span>
              </div>
            ))}
          </div>
          <hr className="border-rosa-100" />
          <div className="space-y-1">
            <div className="text-[19px] font-semibold capitalize">{fechaLarga(c.inicio)}</div>
            <div className="text-[16px]">{hora(c.inicio)} – {hora(c.fin)}</div>
            <div className="text-[14px] text-tinta-tenue">Duración: {duracion(c.duracion_minutos)}</div>
            {c.negocio.ubicacion && <div className="text-[14px] mt-2">📍 {c.negocio.ubicacion}</div>}
          </div>
          {Number(c.anticipo) > 0 && (
            <>
              <hr className="border-rosa-100" />
              <div className="space-y-1 text-[14px]">
                <div className="flex justify-between"><span>Precio</span><span>{dinero(Number(c.total), c.moneda)}</span></div>
                <div className="flex justify-between"><span>Anticipo</span><span>{dinero(Number(c.anticipo), c.moneda)}</span></div>
                <div className="flex justify-between font-medium"><span>Saldo</span><span>{dinero(Number(c.saldo), c.moneda)}</span></div>
              </div>
            </>
          )}
        </Tarjeta>

        {error && <Aviso>{error}</Aviso>}

        {activa && !confirmando && (
          <div className="space-y-3">
            {c.negocio.whatsapp && (
              <a href={`https://wa.me/53${c.negocio.whatsapp}`} target="_blank" rel="noreferrer">
                <Boton ancho variante="secundario">Contactar</Boton>
              </a>
            )}
            <Boton ancho variante="peligro" onClick={() => setConfirmando(true)}>
              Cancelar cita
            </Boton>
          </div>
        )}

        {confirmando && (
          <Tarjeta className="space-y-4 border border-rosa-200">
            <h2 className="text-[19px] font-semibold">¿Cancelar tu cita?</h2>
            <p className="text-[14px] text-tinta-suave capitalize">
              {c.servicios?.map(s => s.nombre).join(' + ')}<br />
              <span className="normal-case">{fechaLarga(c.inicio)}, {hora(c.inicio)}</span>
            </p>
            <div className="space-y-2">
              <Boton ancho variante="secundario" onClick={() => setConfirmando(false)}>
                No, conservarla
              </Boton>
              <Boton ancho variante="peligro" cargando={trabajando} onClick={cancelar}>
                Sí, cancelar
              </Boton>
            </div>
          </Tarjeta>
        )}

        <Link to="/" className="block text-center text-rosa-800 underline min-h-[44px] leading-[44px]">
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
