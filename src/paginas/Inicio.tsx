import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { obtenerNegocio, obtenerServicios } from '../lib/api'
import { Boton, Etiqueta, Esqueleto, Aviso } from '../componentes/ui'
import { dinero, duracion } from '../lib/formato'
import { mensajeDeError } from '../lib/errores'

export default function Inicio() {
  const qNegocio = useQuery({ queryKey:['negocio'], queryFn: obtenerNegocio })
  const qServicios = useQuery({ queryKey:['servicios'], queryFn: obtenerServicios })
  const n = qNegocio.data
  const BASE = import.meta.env.BASE_URL

  return (
    <div className="pb-24">
      {/* HERO con foto de portada */}
      <section className="relative">
        <div className="relative aspect-[16/10] sm:aspect-[16/9] overflow-hidden">
          <img
            src={`${BASE}hero-lynn.jpg`}
            alt="Nails by Lynn"
            className="w-full h-full object-cover"
            fetchPriority="high"
          />
          {/* Degradado inferior para que el logo blanco resalte */}
          <div className="absolute inset-0"
               style={{ background:'linear-gradient(to bottom, transparent 40%, rgba(43,23,33,0.55) 100%)' }} />
          <img
            src={`${BASE}logo-horizontal-blanco.png`}
            alt=""
            className="absolute bottom-5 left-1/2 -translate-x-1/2 w-40"
            aria-hidden
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </div>

        <div className="px-5 pt-8 text-center">
          {qNegocio.isLoading
            ? <Esqueleto className="h-8 w-56 mx-auto" />
            : <>
                <h1 className="font-display text-[30px] leading-tight text-tinta">
                  {n?.tagline ?? 'Uñas que hablan por ti'}
                </h1>
                <p className="text-tinta-suave mt-2">
                  {n?.description ?? 'Estudio de uñas en Peñas Altas.'}
                </p>
              </>
          }
        </div>
      </section>

      <div className="px-5 mt-6 space-y-3">
        {n && !n.is_accepting_bookings ? (
          <Aviso tipo="aviso">{n.closed_message ?? 'Ahora mismo no estamos tomando reservas.'}</Aviso>
        ) : (
          <>
            <Link to="/reservar"><Boton ancho>Reservar cita</Boton></Link>
            <Link to="/servicios"><Boton ancho variante="secundario">Ver servicios</Boton></Link>
          </>
        )}
      </div>

      <section className="px-5 mt-12">
        <Etiqueta>Nuestros servicios</Etiqueta>
        <div className="mt-4 space-y-3">
          {qServicios.isLoading && Array.from({length:3}).map((_,i) =>
            <Esqueleto key={i} className="h-20" />)}
          {qServicios.isError && <Aviso>{mensajeDeError(qServicios.error)}</Aviso>}
          {qServicios.data?.map(s => (
            <Link key={s.id} to={`/reservar?servicio=${s.slug}`}
              className="block bg-white rounded-lg shadow-sm p-4 border border-rosa-100">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <div className="text-[19px] font-semibold">{s.name}</div>
                  <div className="text-[14px] text-tinta-tenue">{duracion(s.duration_minutes)}</div>
                </div>
                <div className="font-display text-[22px] shrink-0">
                  {dinero(Number(s.price), s.currency)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {n && (
        <section className="px-5 mt-12 space-y-2">
          <Etiqueta>Dónde estamos</Etiqueta>
          <p className="text-[16px] mt-3">📍 {n.location_label}</p>
          <p className="text-[14px] text-tinta-tenue">Lunes a sábado · 9:00 AM – 6:00 PM</p>
          {n.phone_whatsapp && (
            <a href={`https://wa.me/53${n.phone_whatsapp}`} target="_blank" rel="noreferrer"
               className="inline-block text-rosa-800 underline text-[16px] min-h-[44px] leading-[44px]">
              Escribir por WhatsApp
            </a>
          )}
        </section>
      )}
    </div>
  )
}
