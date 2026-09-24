import { useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerCita, cancelarCita } from '../lib/api'
import { Boton, Tarjeta, Pildora, Esqueleto, Aviso } from '../componentes/ui'
import { fechaLarga, hora, duracion, dinero } from '../lib/formato'
import { mensajeDeError } from '../lib/errores'
import { olvidarToken } from '../lib/almacenamiento'

function mensajeAvisoLynn(c: {
  code: string; inicio: string; duracion_minutos: number;
  total: number; moneda: string;
  cliente: { nombre: string; telefono: string };
  servicios: { nombre: string; precio: number }[];
}): string {
  const fecha = new Intl.DateTimeFormat('es', {
    timeZone: 'America/Havana', weekday: 'long', day: 'numeric', month: 'long'
  }).format(new Date(c.inicio))
  const hora = new Intl.DateTimeFormat('es', {
    timeZone: 'America/Havana', hour: 'numeric', minute: '2-digit', hour12: true
  }).format(new Date(c.inicio))
  const servicios = c.servicios.map(s => `• ${s.nombre}`).join('\n')
  return `Hola Lynn! Acabo de reservar una cita 💅

👤 ${c.cliente.nombre}
📱 ${c.cliente.telefono}
📅 ${fecha} a las ${hora}
⏱ ${c.duracion_minutos} min
💵 ${c.total.toLocaleString('es-CU')} ${c.moneda}

Servicios:
${servicios}

🔖 Código: ${c.code}`
}

function enlaceAvisoLynn(telefonoLynn: string, mensaje: string): string {
  const digitos = telefonoLynn.replace(/\D/g, '')
  const conPrefijo = digitos.length === 8 ? '53' + digitos : digitos
  return `https://wa.me/${conPrefijo}?text=${encodeURIComponent(mensaje)}`
}

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
          <p className="text-[14px] text-tinta-suave mt-3 max-w-xs mx-auto">
            Toca el botón de abajo para avisar a Lynn.
          </p>
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

        {esNueva && c.negocio.whatsapp && (
          <a
            href={enlaceAvisoLynn(c.negocio.whatsapp, mensajeAvisoLynn(c))}
            target="_blank" rel="noreferrer"
            className="block w-full min-h-[56px] bg-[#25D366] hover:bg-[#20BA5A]
                       text-white font-semibold text-[17px]
                       rounded-sm px-4 flex items-center justify-center gap-2
                       shadow-sm active:scale-[0.98] transition-transform"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M17.5 14.4c-.3-.15-1.7-.85-2-.95s-.5-.15-.7.15-.8.95-1 1.15-.35.2-.65.05-1.25-.45-2.4-1.45c-.9-.8-1.5-1.75-1.65-2.05s-.05-.45.1-.6c.15-.15.3-.35.45-.55s.2-.3.3-.5.05-.35 0-.5-.7-1.7-1-2.35c-.25-.6-.5-.55-.7-.55h-.6c-.2 0-.55.05-.85.4s-1.1 1.05-1.1 2.55 1.15 2.95 1.3 3.15c.15.2 2.25 3.45 5.5 4.85.75.35 1.35.55 1.85.7.75.25 1.45.2 2 .1.6-.1 1.7-.7 2-1.35s.3-1.2.2-1.35c-.1-.15-.3-.25-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 4.95L2 22l5.25-1.35C8.65 21.5 10.3 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2z"/>
            </svg>
            Avisar a Lynn por WhatsApp
          </a>
        )}

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
