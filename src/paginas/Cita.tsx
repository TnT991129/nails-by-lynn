import { useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerCita, cancelarCita } from '../lib/api'
import { Boton, Tarjeta, Pildora, Esqueleto, Aviso, estiloBoton } from '../componentes/ui'
import { IconoCheck, IconoUbicacion, IconoWhatsApp, IconoReloj } from '../componentes/iconos'
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
    <div className="pb-28">
      {esNueva ? (
        <section className="px-5 pt-14 pb-12 text-center bg-gradient-to-b from-rosa-100 via-rosa-50 to-superficie-base">
          <div className="w-20 h-20 rounded-full bg-rosa-600 text-white shadow-boton ring-8 ring-white/70
                          flex items-center justify-center mx-auto mb-6 animate-entrada">
            <IconoCheck tam={36} strokeWidth={2.6} />
          </div>
          <h1 className="text-[32px] leading-tight">¡Tu cita está confirmada!</h1>
          <p className="text-[15px] text-tinta-suave mt-3 max-w-xs mx-auto">
            Toca el botón verde de abajo para avisar a Lynn por WhatsApp.
          </p>
        </section>
      ) : (
        <section className="px-4 pt-8 pb-2">
          <h1 className="text-[34px] leading-tight">Tu cita</h1>
        </section>
      )}

      <div className="px-4 pt-4 space-y-4">
        <Tarjeta className="p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-4 flex items-center justify-between">
            <span className="font-mono text-[13px] tracking-wider text-tinta-tenue">{c.code}</span>
            <Pildora estado={c.estado} />
          </div>
          <div className="px-5 pb-5">
            <div className="text-[22px] font-semibold capitalize leading-tight">{fechaLarga(c.inicio)}</div>
            <div className="flex items-center gap-1.5 text-[15px] text-tinta-suave mt-1.5">
              <IconoReloj tam={16} /> {hora(c.inicio)} – {hora(c.fin)} · {duracion(c.duracion_minutos)}
            </div>
            {c.negocio.ubicacion && (
              <div className="flex items-center gap-1.5 text-[15px] text-tinta-suave mt-1">
                <IconoUbicacion tam={16} /> {c.negocio.ubicacion}
              </div>
            )}
          </div>
          <div className="border-t border-dashed border-rosa-200 px-5 py-4 space-y-1.5 bg-rosa-50/40">
            {c.servicios?.map((s, i) => (
              <div key={i} className="flex justify-between text-[15px]">
                <span>{s.nombre}</span><span className="font-medium">{dinero(Number(s.precio), c.moneda)}</span>
              </div>
            ))}
          </div>
          {Number(c.anticipo) > 0 && (
            <>
              <div className="border-t border-rosa-100 px-5 py-4 space-y-1 text-[14px]">
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
            className="w-full min-h-[56px] bg-[#25D366] hover:bg-[#20BA5A]
                       text-white font-semibold text-[17px]
                       rounded-full px-4 flex items-center justify-center gap-2
                       shadow-[0_10px_24px_-10px_rgba(37,211,102,.7)] active:scale-[0.98] transition"
          >
            <IconoWhatsApp tam={22} />
            Avisar a Lynn por WhatsApp
          </a>
        )}

        {error && <Aviso>{error}</Aviso>}

        {activa && !confirmando && (
          <div className="space-y-3">
            {c.negocio.whatsapp && (
              <a href={`https://wa.me/53${c.negocio.whatsapp}`} target="_blank" rel="noreferrer"
                 className={estiloBoton('secundario', true)}>
                <IconoWhatsApp tam={19} /> Contactar
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

        <Link to="/" className="block text-center text-rosa-800 font-medium min-h-[44px] leading-[44px]">
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
