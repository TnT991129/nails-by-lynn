import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { obtenerNegocio, obtenerServicios } from '../lib/api'
import { Etiqueta, Esqueleto, Aviso, estiloBoton } from '../componentes/ui'
import { IconoReloj, IconoUbicacion, IconoFlecha, IconoWhatsApp, IconoCalendario, IconoDestellos } from '../componentes/iconos'
import { dinero, duracion, descripcionServicio, numeroWhatsApp } from '../lib/formato'
import { mensajeDeError } from '../lib/errores'
import { useHorarioPublico } from '../lib/useHorarioPublico'
import BotonTema from '../componentes/BotonTema'
import EnCup from '../componentes/EnCup'
import ResenasInicio from '../caracteristicas/resenas/ResenasInicio'
import { useTextos } from '../lib/textos'
import { Revelar, useParalaje, useVisto } from '../componentes/Movimiento'

// Retraso de una animación de entrada (CSS lee --retraso o animation-delay)
const espera = (ms: number) => ({ animationDelay: `${ms}ms` }) as CSSProperties

export default function Inicio() {
  const qNegocio = useQuery({ queryKey:['negocio'], queryFn: obtenerNegocio })
  const qServicios = useQuery({ queryKey:['servicios'], queryFn: obtenerServicios })
  const n = qNegocio.data
  const BASE = import.meta.env.BASE_URL
  const cerrado = n && !n.is_accepting_bookings
  const horario = useHorarioPublico()
  const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
  const t = useTextos()
  const ubicacion = n?.location_label ?? 'Peñas Altas'
  const fotoPortada = useParalaje<HTMLDivElement>(0.12, 56)   // la capa sobresale un 16 % por arriba
  const [refPasos, pasosVistos] = useVisto<HTMLOListElement>()

  const PASOS = [
    { titulo: t('inicio.paso1_titulo'), texto: t('inicio.paso1_texto') },
    { titulo: t('inicio.paso2_titulo'), texto: horario.turnos ? t('inicio.paso2_texto', { turnos: horario.turnos }) : 'Elige el turno que prefieras.' },
    { titulo: t('inicio.paso3_titulo'), texto: t('inicio.paso3_texto') },
  ]

  return (
    <div className="relative isolate pb-28">
      {/* Luces rosadas que se mueven despacio detrás de la portada (decoración) */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[720px] overflow-hidden -z-10">
        <div className="absolute -top-16 -right-24 w-80 h-80 rounded-full bg-rosa-300/35 blur-3xl animate-deriva" />
        <div className="absolute top-72 -left-28 w-72 h-72 rounded-full bg-rosa-200/50 blur-3xl animate-deriva"
             style={{ animationDelay: '-7s' }} />
      </div>

      <header className="relative flex justify-center pt-5 pb-4 animate-pagina">
        <BotonTema className="absolute right-4 top-4" />
        <picture>
          <source srcSet={`${BASE}logo-horizontal-rosa.webp`} type="image/webp" />
          <img src={`${BASE}logo-horizontal-rosa.png`} alt="Nails by Lynn"
               width={101} height={44} className="h-11 w-auto" />
        </picture>
      </header>

      {/* HERO */}
      <section className="px-4">
        <div className="relative overflow-hidden rounded-xl shadow-lg aspect-[4/5] sm:aspect-[16/10] animate-ampliar
                        ring-1 ring-rosa-200/60">
          {/* Capa de la foto: se acerca al abrir y baja más despacio que la página al hacer scroll */}
          <div ref={fotoPortada} className="absolute inset-x-0 -top-[16%] bottom-0 will-change-transform">
            <div className="absolute inset-0 animate-acercar">
              {/* La foto que Lynn pone en el panel (Más → Portada de la web) o, si no hay, la de siempre */}
              {qNegocio.isLoading ? (
                <div className="absolute inset-0 reflejo" />
              ) : n?.hero_image_url ? (
                <img src={n.hero_image_url} alt="Lynn en su estudio de uñas" crossOrigin="anonymous"
                     className="absolute inset-0 w-full h-full object-cover"
                     {...{ fetchpriority: 'high' }} />
              ) : (
                // En móvil, recorte vertical ya encuadrado (32 KB); en pantallas anchas, la foto completa
                <picture>
                  <source media="(min-width: 640px)" srcSet={`${BASE}hero-lynn.webp`} type="image/webp" />
                  <source srcSet={`${BASE}hero-lynn-movil.webp`} type="image/webp" />
                  <img src={`${BASE}hero-lynn.jpg`} alt="Lynn en su estudio de uñas"
                       className="absolute inset-0 w-full h-full object-cover object-[60%_center]"
                       {...{ fetchpriority: 'high' }} />{/* React 18 solo pasa el atributo en minúsculas */}
                </picture>
              )}
            </div>
          </div>
          <div className="absolute inset-0"
               style={{ background:'radial-gradient(circle at 12% 8%, rgba(238,67,151,.30), transparent 48%),'
                                 + 'linear-gradient(to bottom, rgba(43,23,33,0) 32%, rgba(43,23,33,.88) 100%)' }} />

          {/* Destellos que titilan sobre la foto */}
          <div aria-hidden className="absolute inset-0 text-white pointer-events-none">
            <IconoDestellos tam={22} className="absolute top-[12%] right-[14%] animate-centelleo" />
            <IconoDestellos tam={14} className="absolute top-[24%] right-[30%] animate-centelleo" style={espera(900)} />
            <IconoDestellos tam={16} className="absolute top-[40%] left-[10%] animate-centelleo" style={espera(1700)} />
          </div>

          <div className="absolute inset-x-0 bottom-0 p-6 text-white">
            <span className="inline-block text-[11px] font-semibold tracking-[0.2em] uppercase animate-pagina
                             bg-white/15 backdrop-blur px-3 py-1 rounded-full border border-white/25"
                  style={espera(250)}>
              {t('inicio.etiqueta', { ubicacion })}
            </span>
            {/* Frase sobre la foto solo si Lynn escribe una en «Textos de la web» */}
            {t('inicio.titulo')
              ? <h1 className="font-display text-[34px] leading-[1.1] mt-3 linea-mascara">
                  <span style={{ '--retraso': '380ms' } as CSSProperties}>{t('inicio.titulo')}</span>
                </h1>
              : <h1 className="sr-only">Nails by Lynn</h1>}
            {!cerrado && (
              <Link to="/reservar" className={`${estiloBoton('primario', true)} brillo group mt-5 animate-pagina`}
                    style={espera(550)}>
                {t('inicio.boton_reservar')}
                <IconoFlecha tam={18} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            )}
          </div>
        </div>

        {cerrado && (
          <div className="mt-4">
            <Aviso tipo="aviso">{t('inicio.cerrado', {}, n.closed_message)}</Aviso>
          </div>
        )}

        {/* Datos rápidos */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {[
            { icono: <IconoReloj tam={19} />, titulo: horario.dias ? mayus(horario.dias) : t('inicio.horario_titulo'),
              texto: horario.turnos || t('inicio.horario_texto') },
            { icono: <IconoUbicacion tam={19} />, titulo: ubicacion, texto: t('inicio.ubicacion_texto') },
          ].map((d, i) => (
            <Revelar key={i} retraso={i * 120}
              className="bg-papel/90 backdrop-blur rounded-lg border border-rosa-100/80 p-3.5 flex items-start gap-2.5
                         shadow-sm">
              <span className="w-8 h-8 rounded-full bg-rosa-50 text-rosa-600 flex items-center justify-center shrink-0">
                {d.icono}
              </span>
              <div className="text-[13px] leading-snug">
                <div className="font-semibold">{d.titulo}</div>
                <div className="text-tinta-tenue">{d.texto}</div>
              </div>
            </Revelar>
          ))}
        </div>
      </section>

      {/* SERVICIOS */}
      <section className="px-4 mt-14">
        <Revelar>
          <Etiqueta>{t('inicio.servicios_etiqueta')}</Etiqueta>
          <div className="flex items-end justify-between gap-3 mt-2 mb-5">
            {/* Título solo si Lynn escribe uno en «Textos de la web» */}
            {t('inicio.servicios_titulo') ? <h2 className="text-[28px] leading-tight">{t('inicio.servicios_titulo')}</h2> : <span />}
            <span className="text-[13px] text-tinta-tenue pb-1">{t('inicio.servicios_ayuda')}</span>
          </div>
        </Revelar>

        <div className="space-y-3">
          {qServicios.isLoading && Array.from({length:3}).map((_,i) =>
            <Esqueleto key={i} className="h-24" />)}
          {qServicios.isError && <Aviso>{mensajeDeError(qServicios.error)}</Aviso>}
          {qServicios.data && qServicios.data.length === 0 && (
            <p className="text-[14px] text-tinta-tenue bg-papel rounded-lg border border-rosa-100 p-4">
              {t('inicio.sin_servicios')}
            </p>
          )}
          {qServicios.data?.map((s, i) => (
            <Revelar key={s.id} retraso={Math.min(i, 4) * 90}>
              <Link to={`/reservar?servicio=${s.slug}`}
                className="group block bg-papel rounded-xl border border-rosa-100/80 shadow-suave p-4
                           transition duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:border-rosa-200
                           active:scale-[0.99]">
                <div className="flex items-center gap-4">
                  {s.cover_image_url && (
                    <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-rosa-50">
                      <img src={s.cover_image_url} alt={s.name} loading="lazy" crossOrigin="anonymous"
                           className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[18px] font-semibold">{s.name}</div>
                    <div className="flex items-center gap-1.5 text-[13px] text-tinta-tenue mt-1">
                      <IconoReloj tam={15} /> {duracion(s.duration_minutes)}
                    </div>
                    {descripcionServicio(s.short_description) && (
                      <p className="text-[14px] text-tinta-suave mt-2 line-clamp-2">{descripcionServicio(s.short_description)}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="font-display text-[21px] text-rosa-700 text-right">
                      {dinero(Number(s.price))}
                      <EnCup min={Number(s.price)} />
                    </span>
                    <span className="w-9 h-9 rounded-full bg-rosa-50 text-rosa-600 flex items-center justify-center
                                     transition duration-300 group-hover:bg-rosa-600 group-hover:text-white group-hover:shadow-boton">
                      <IconoFlecha tam={17} className="transition-transform duration-300 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            </Revelar>
          ))}
        </div>
      </section>

      <ResenasInicio />

      {/* CÓMO FUNCIONA */}
      <section className="px-4 mt-14">
        <Revelar>
          <Etiqueta>{t('inicio.pasos_etiqueta')}</Etiqueta>
          <h2 className="text-[28px] leading-tight mt-2 mb-5">{t('inicio.pasos_titulo')}</h2>
        </Revelar>
        <ol ref={refPasos} className="relative space-y-3">
          {/* Hilo que une los tres pasos y se dibuja al llegar */}
          <span aria-hidden className={`absolute left-9 top-8 bottom-8 w-0.5 -ml-px origin-top rounded-full
                                         bg-gradient-to-b from-rosa-500 via-rosa-300 to-rosa-200
                                         ${pasosVistos ? 'animate-trazo' : 'scale-y-0'}`} />
          {PASOS.map((p, i) => (
            <Revelar como="li" key={i} retraso={150 + i * 160} efecto="derecha"
              className="relative flex items-center gap-4 bg-papel rounded-lg border border-rosa-100/80 p-4 shadow-sm">
              <span className={`w-10 h-10 rounded-full bg-gradient-to-br from-rosa-600 to-vino text-white shadow-boton
                                font-display text-[18px] flex items-center justify-center shrink-0
                                ${pasosVistos ? 'animate-pop' : 'opacity-0'}`}
                    style={espera(250 + i * 160)}>{i + 1}</span>
              <div>
                <div className="font-semibold text-[15px]">{p.titulo}</div>
                <div className="text-[13px] text-tinta-tenue">{p.texto}</div>
              </div>
            </Revelar>
          ))}
        </ol>
      </section>

      {/* CONTACTO */}
      {n && (
        <section className="px-4 mt-14">
          <Revelar efecto="escala" className="rounded-xl bg-noche text-white p-6 relative overflow-hidden shadow-lg">
            <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full bg-rosa-600/45 blur-2xl animate-deriva" aria-hidden />
            <div className="absolute -bottom-20 -left-12 w-44 h-44 rounded-full bg-rosa-400/25 blur-2xl animate-deriva"
                 style={{ animationDelay: '-5s' }} aria-hidden />
            <IconoDestellos tam={18} aria-hidden className="absolute top-6 right-6 text-[#FBA2D0] animate-centelleo" />
            <span className="relative text-[11px] font-semibold tracking-[0.2em] uppercase text-[#FBA2D0]">{t('inicio.contacto_etiqueta')}</span>
            <h2 className="relative text-[26px] leading-tight mt-2">{t('inicio.contacto_titulo')}</h2>
            <p className="relative text-white/70 text-[14px] mt-2">
              {t('inicio.contacto_texto', { ubicacion })}
            </p>
            <div className="mt-5 space-y-2.5 relative">
              {n.phone_whatsapp && (
                <a href={`https://wa.me/${numeroWhatsApp(n.phone_whatsapp)}`} target="_blank" rel="noreferrer"
                   className="brillo min-h-[52px] w-full rounded-full bg-whatsapp text-white font-semibold
                              inline-flex items-center justify-center gap-2 transition duration-200
                              shadow-[0_10px_24px_-10px_rgba(37,211,102,.7)] hover:-translate-y-0.5 hover:bg-whatsapp-oscuro
                              active:scale-[0.98]">
                  <IconoWhatsApp tam={20} /> {t('inicio.boton_whatsapp')}
                </a>
              )}
              {!cerrado && (
                <Link to="/reservar"
                  className="min-h-[52px] w-full rounded-full border border-white/30 text-white font-semibold
                             inline-flex items-center justify-center gap-2 transition duration-200
                             hover:bg-white/10 hover:border-white/50 active:scale-[0.98]">
                  <IconoCalendario tam={19} /> {t('inicio.boton_reservar')}
                </Link>
              )}
            </div>
          </Revelar>
          <p className="text-center mt-4">
            <Link to="/politicas" className="text-[13px] text-tinta-tenue underline underline-offset-2 inline-block min-h-[44px] leading-[44px]
                                             hover:text-rosa-700 transition-colors">
              {t('inicio.enlace_politicas')}
            </Link>
          </p>
        </section>
      )}
    </div>
  )
}
