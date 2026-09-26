import { useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerCita, cancelarCita } from '../lib/api'
import { Boton, Tarjeta, Pildora, Esqueleto, Aviso, estiloBoton } from '../componentes/ui'
import { IconoCheck, IconoUbicacion, IconoWhatsApp, IconoReloj, IconoCalendario } from '../componentes/iconos'
import { fechaLarga, hora, duracion, dinero } from '../lib/formato'
import { mensajeDeError } from '../lib/errores'
import { olvidarToken, citaAvisada, marcarAvisada } from '../lib/almacenamiento'
import { EnlacePoliticas } from '../componentes/Politicas'
import ReprogramarCita from '../caracteristicas/reserva/ReprogramarCita'

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
  const [reprogramando, setReprogramando] = useState(false)
  const [avisadaAhora, setAvisadaAhora] = useState(false)

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
  // Reglas de settings: se puede cambiar hasta X horas antes y un máximo de veces
  const horasHasta = (new Date(c.inicio).getTime() - Date.now()) / 3_600_000
  const reglasCambio = c.max_reprogramaciones !== undefined && c.horas_minimas_reprogramar !== undefined
  const quedanCambios = reglasCambio && c.reprogramaciones < c.max_reprogramaciones!
  const aTiempo = reglasCambio && horasHasta >= c.horas_minimas_reprogramar!
  const puedeCambiar = activa && quedanCambios && aTiempo

  // Insistimos en que avise a Lynn: es como ella se entera de la reserva
  const avisada = avisadaAhora || citaAvisada(c.code)
  const enlaceAviso = c.negocio.whatsapp ? enlaceAvisoLynn(c.negocio.whatsapp, mensajeAvisoLynn(c)) : null
  const alAvisar = () => { marcarAvisada(c.code); setAvisadaAhora(true) }
  const bloqueAviso = activa && enlaceAviso && (!avisada ? (
    <div className="rounded-xl border-2 border-[#25D366] bg-[#E9FBF0] p-4 space-y-3 animate-entrada">
      <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#25D366] text-white text-[11px] font-bold uppercase tracking-wider">
        {esNueva ? 'Último paso' : '¿Ya avisaste a Lynn?'}
      </span>
      <p className="text-[15px] text-tinta leading-snug">
        <b>Avisa a Lynn por WhatsApp</b> para que sepa de tu cita y te la confirme.
        El mensaje ya va escrito: solo tienes que tocar <b>Enviar</b>.
      </p>
      <a href={enlaceAviso} target="_blank" rel="noreferrer" onClick={alAvisar}
         className="w-full min-h-[56px] bg-[#25D366] hover:bg-[#20BA5A] text-white font-semibold text-[17px]
                    rounded-full px-4 flex items-center justify-center gap-2 animate-latido
                    shadow-[0_10px_24px_-10px_rgba(37,211,102,.7)] active:scale-[0.98] transition">
        <IconoWhatsApp tam={22} />
        Avisar a Lynn por WhatsApp
      </a>
    </div>
  ) : esNueva && (
    <p className="flex items-center justify-center gap-2 text-[14px] text-estado-exito">
      <IconoCheck tam={16} strokeWidth={2.6} /> Aviso abierto en WhatsApp.
      <a href={enlaceAviso} target="_blank" rel="noreferrer" className="underline text-rosa-800">¿No se envió? Otra vez</a>
    </p>
  ))

  return (
    <div className="pb-28">
      {esNueva ? (
        <section className="px-5 pt-14 pb-12 text-center bg-gradient-to-b from-rosa-100 via-rosa-50 to-superficie-base">
          <div className="w-20 h-20 rounded-full bg-rosa-600 text-white shadow-boton ring-8 ring-white/70
                          flex items-center justify-center mx-auto mb-6 animate-entrada">
            <IconoCheck tam={36} strokeWidth={2.6} />
          </div>
          <h1 className="text-[32px] leading-tight">¡Tu cita está reservada!</h1>
          <p className="text-[15px] text-tinta-suave mt-3 max-w-xs mx-auto">
            Tu turno ya está guardado. Te falta un paso: avisar a Lynn 👇
          </p>
        </section>
      ) : (
        <section className="px-4 pt-8 pb-2">
          <h1 className="text-[34px] leading-tight">Tu cita</h1>
        </section>
      )}

      <div className="px-4 pt-4 space-y-4">
        {esNueva && bloqueAviso}

        <Tarjeta className="p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-4 flex items-center justify-between">
            <span className="font-mono text-[13px] tracking-wider text-tinta-tenue">{c.code}</span>
            <Pildora estado={c.estado} />
          </div>
          <div className="px-5 pb-5">
            <div className="text-[22px] font-semibold first-letter:uppercase leading-tight">{fechaLarga(c.inicio)}</div>
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

        {!esNueva && bloqueAviso}

        {error && <Aviso>{error}</Aviso>}

        {reprogramando && (
          <ReprogramarCita token={token} cita={c} onCerrar={() => setReprogramando(false)} />
        )}

        {activa && !confirmando && !reprogramando && (
          <div className="space-y-3">
            {/* Acciones principales, lado a lado; cancelar queda como enlace discreto */}
            <div className={`grid gap-2.5 ${puedeCambiar && c.negocio.whatsapp ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {puedeCambiar && (
                <Boton variante="secundario" onClick={() => { setReprogramando(true); setError(null) }}
                       className="!px-3 !text-[15px]">
                  <IconoCalendario tam={18} /> Cambiar fecha
                </Boton>
              )}
              {c.negocio.whatsapp && (
                <a href={`https://wa.me/53${c.negocio.whatsapp}`} target="_blank" rel="noreferrer"
                   className={`${estiloBoton('secundario')} !px-3 !text-[15px]`}>
                  <IconoWhatsApp tam={18} /> Escribir a Lynn
                </a>
              )}
            </div>
            {reglasCambio && !puedeCambiar && (
              <p className="text-[13px] text-tinta-tenue text-center">
                {!quedanCambios
                  ? `Ya cambiaste esta cita ${c.reprogramaciones} ${c.reprogramaciones === 1 ? 'vez' : 'veces'}, el máximo permitido.`
                  : `Los cambios se hacen hasta ${c.horas_minimas_reprogramar} horas antes.`}
                {' '}Si necesitas moverla, escríbeme por WhatsApp.
              </p>
            )}
            <div className="flex items-center justify-center gap-1 text-[13px] text-tinta-tenue pt-1">
              <button onClick={() => setConfirmando(true)}
                      className="min-h-[44px] px-2 text-estado-error underline underline-offset-2">
                Cancelar cita
              </button>
              <span aria-hidden>·</span>
              <EnlacePoliticas texto="Políticas" className="min-h-[44px] px-2 !font-normal !text-tinta-tenue" />
            </div>
          </div>
        )}

        {confirmando && (
          <Tarjeta className="space-y-4 border border-rosa-200">
            <h2 className="text-[19px] font-semibold">¿Cancelar tu cita?</h2>
            <p className="text-[14px] text-tinta-suave first-letter:uppercase">
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
