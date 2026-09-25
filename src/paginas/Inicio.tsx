import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { obtenerNegocio, obtenerServicios } from '../lib/api'
import { Etiqueta, Esqueleto, Aviso, estiloBoton } from '../componentes/ui'
import { IconoReloj, IconoUbicacion, IconoFlecha, IconoWhatsApp, IconoCalendario } from '../componentes/iconos'
import { dinero, duracion } from '../lib/formato'
import { mensajeDeError } from '../lib/errores'

const PASOS = [
  { titulo: 'Elige tu servicio', texto: 'Y los extras que quieras añadir.' },
  { titulo: 'Escoge día y turno', texto: 'Turnos a las 9:00 AM y 1:00 PM.' },
  { titulo: 'Confirma y avisa', texto: 'Tu cita queda guardada al instante.' },
]

export default function Inicio() {
  const qNegocio = useQuery({ queryKey:['negocio'], queryFn: obtenerNegocio })
  const qServicios = useQuery({ queryKey:['servicios'], queryFn: obtenerServicios })
  const n = qNegocio.data
  const BASE = import.meta.env.BASE_URL
  const cerrado = n && !n.is_accepting_bookings

  return (
    <div className="pb-28">
      <header className="flex justify-center pt-5 pb-4">
        <picture>
          <source srcSet={`${BASE}logo-horizontal-rosa.webp`} type="image/webp" />
          <img src={`${BASE}logo-horizontal-rosa.png`} alt="Nails by Lynn"
               width={101} height={44} className="h-11 w-auto" />
        </picture>
      </header>

      {/* HERO */}
      <section className="px-4">
        <div className="relative overflow-hidden rounded-xl shadow-lg aspect-[4/5] sm:aspect-[16/10]">
          {/* En móvil, recorte vertical ya encuadrado (32 KB); en pantallas anchas, la foto completa */}
          <picture>
            <source media="(min-width: 640px)" srcSet={`${BASE}hero-lynn.webp`} type="image/webp" />
            <source srcSet={`${BASE}hero-lynn-movil.webp`} type="image/webp" />
            <img src={`${BASE}hero-lynn.jpg`} alt="Lynn en su estudio de uñas"
                 className="absolute inset-0 w-full h-full object-cover object-[60%_center]"
                 fetchPriority="high" />
          </picture>
          <div className="absolute inset-0"
               style={{ background:'linear-gradient(to bottom, rgba(43,23,33,0) 35%, rgba(43,23,33,.85) 100%)' }} />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white">
            <span className="inline-block text-[11px] font-semibold tracking-[0.2em] uppercase
                             bg-white/15 backdrop-blur px-3 py-1 rounded-full border border-white/25">
              Estudio de uñas · {n?.location_label ?? 'Peñas Altas'}
            </span>
            {qNegocio.isLoading
              ? <Esqueleto className="h-9 w-56 mt-4 bg-white/30" />
              : <h1 className="font-display text-[34px] leading-[1.1] mt-3">
                  {n?.tagline ?? 'Uñas que hablan por ti'}
                </h1>}
            {!cerrado && (
              <Link to="/reservar" className={`${estiloBoton('primario', true)} mt-5`}>
                Reservar cita <IconoFlecha tam={18} />
              </Link>
            )}
          </div>
        </div>

        {cerrado && (
          <div className="mt-4">
            <Aviso tipo="aviso">{n.closed_message ?? 'Ahora mismo no estamos tomando reservas.'}</Aviso>
          </div>
        )}

        {/* Datos rápidos */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-white rounded-lg border border-rosa-100/80 p-3.5 flex items-start gap-2.5">
            <IconoReloj tam={20} className="text-rosa-600 shrink-0 mt-0.5" />
            <div className="text-[13px] leading-snug">
              <div className="font-semibold">Lunes a sábado</div>
              <div className="text-tinta-tenue">9:00 AM y 1:00 PM</div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-rosa-100/80 p-3.5 flex items-start gap-2.5">
            <IconoUbicacion tam={20} className="text-rosa-600 shrink-0 mt-0.5" />
            <div className="text-[13px] leading-snug">
              <div className="font-semibold">{n?.location_label ?? 'Peñas Altas'}</div>
              <div className="text-tinta-tenue">Cita previa</div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICIOS */}
      <section className="px-4 mt-12">
        <Etiqueta>Servicios</Etiqueta>
        <div className="flex items-end justify-between gap-3 mt-2 mb-5">
          <h2 className="text-[28px] leading-tight">Elige tu estilo</h2>
          <span className="text-[13px] text-tinta-tenue pb-1">Toca para reservar</span>
        </div>

        <div className="space-y-3">
          {qServicios.isLoading && Array.from({length:3}).map((_,i) =>
            <Esqueleto key={i} className="h-24" />)}
          {qServicios.isError && <Aviso>{mensajeDeError(qServicios.error)}</Aviso>}
          {qServicios.data?.map(s => (
            <Link key={s.id} to={`/reservar?servicio=${s.slug}`}
              className="group block bg-white rounded-xl border border-rosa-100/80 shadow-suave p-4
                         active:scale-[0.99] transition">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-[18px] font-semibold">{s.name}</div>
                  <div className="flex items-center gap-1.5 text-[13px] text-tinta-tenue mt-1">
                    <IconoReloj tam={15} /> {duracion(s.duration_minutes)}
                  </div>
                  {s.short_description && (
                    <p className="text-[14px] text-tinta-suave mt-2 line-clamp-2">{s.short_description}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="font-display text-[21px] text-rosa-700">
                    {dinero(Number(s.price), s.currency)}
                  </span>
                  <span className="w-9 h-9 rounded-full bg-rosa-50 text-rosa-600 flex items-center justify-center
                                   group-hover:bg-rosa-600 group-hover:text-white transition-colors">
                    <IconoFlecha tam={17} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="px-4 mt-12">
        <Etiqueta>Así de fácil</Etiqueta>
        <h2 className="text-[28px] leading-tight mt-2 mb-5">Reserva en un minuto</h2>
        <ol className="space-y-3">
          {PASOS.map((p, i) => (
            <li key={p.titulo} className="flex items-center gap-4 bg-white rounded-lg border border-rosa-100/80 p-4">
              <span className="w-10 h-10 rounded-full bg-rosa-600 text-white font-display text-[18px]
                               flex items-center justify-center shrink-0">{i + 1}</span>
              <div>
                <div className="font-semibold text-[15px]">{p.titulo}</div>
                <div className="text-[13px] text-tinta-tenue">{p.texto}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* CONTACTO */}
      {n && (
        <section className="px-4 mt-12">
          <div className="rounded-xl bg-tinta text-white p-6 relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-rosa-600/40 blur-2xl" aria-hidden />
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-rosa-300">Contacto</span>
            <h2 className="text-[26px] leading-tight mt-2">¿Tienes alguna duda?</h2>
            <p className="text-white/70 text-[14px] mt-2">
              Escríbeme y te respondo en cuanto pueda. Estoy en {n.location_label}.
            </p>
            <div className="mt-5 space-y-2.5 relative">
              {n.phone_whatsapp && (
                <a href={`https://wa.me/53${n.phone_whatsapp}`} target="_blank" rel="noreferrer"
                   className="min-h-[52px] w-full rounded-full bg-[#25D366] text-white font-semibold
                              inline-flex items-center justify-center gap-2 active:scale-[0.98] transition">
                  <IconoWhatsApp tam={20} /> Escribir por WhatsApp
                </a>
              )}
              {!cerrado && (
                <Link to="/reservar"
                  className="min-h-[52px] w-full rounded-full border border-white/30 text-white font-semibold
                             inline-flex items-center justify-center gap-2 active:scale-[0.98] transition">
                  <IconoCalendario tam={19} /> Reservar cita
                </Link>
              )}
            </div>
          </div>
          <p className="text-center mt-4">
            <Link to="/politicas" className="text-[13px] text-tinta-tenue underline underline-offset-2 inline-block min-h-[44px] leading-[44px]">
              Políticas del estudio
            </Link>
          </p>
        </section>
      )}
    </div>
  )
}
