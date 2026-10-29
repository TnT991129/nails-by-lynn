import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { obtenerNegocio, obtenerServicios, obtenerFotosPublicas } from '../lib/api'
import { Etiqueta, Esqueleto, Aviso, estiloBoton, TituloSeccion } from '../componentes/ui'
import { IconoReloj, IconoUbicacion, IconoFlecha, IconoWhatsApp, IconoCalendario, IconoDestellos } from '../componentes/iconos'
import { dinero, duracion, descripcionServicio, numeroWhatsApp } from '../lib/formato'
import { mensajeDeError } from '../lib/errores'
import { useHorarioPublico } from '../lib/useHorarioPublico'
import BotonTema from '../componentes/BotonTema'
import EnCup from '../componentes/EnCup'
import ResenasInicio from '../caracteristicas/resenas/ResenasInicio'
import { useTextos } from '../lib/textos'
import { useDiseno, type SeccionInicio } from '../lib/diseno'
import { Revelar, useParalaje, useVisto, useInclinacion, TextoLetras } from '../componentes/Movimiento'
import type { Negocio, Servicio } from '../lib/tipos'
import { registrarEvento } from '../lib/visitas'

// Retraso de una animación de entrada
const espera = (ms: number) => ({ animationDelay: `${ms}ms` }) as CSSProperties
const BASE = import.meta.env.BASE_URL

export default function Inicio() {
  const qNegocio = useQuery({ queryKey: ['negocio'], queryFn: obtenerNegocio })
  const qServicios = useQuery({ queryKey: ['servicios'], queryFn: obtenerServicios })
  const n = qNegocio.data
  const cerrado = !!n && !n.is_accepting_bookings
  const t = useTextos()
  const d = useDiseno()
  const ubicacion = n?.location_label ?? 'Peñas Altas'

  // Cada sección del inicio, en el orden y con la visibilidad que eligió Lynn (Diseño de la web)
  const SECCIONES: Record<SeccionInicio, ReactNode> = {
    datos: <DatosRapidos ubicacion={ubicacion} />,
    cinta: <Cinta servicios={qServicios.data ?? []} />,
    servicios: <Servicios q={qServicios} />,
    galeria: <GaleriaDestacada />,
    resenas: <ResenasInicio />,
    pasos: <Pasos />,
    contacto: n && <Contacto n={n} cerrado={cerrado} ubicacion={ubicacion} />,
  }

  return (
    <div className="relative isolate pb-28">
      {/* Luces rosadas que se mueven despacio detrás de la portada (decoración) */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[720px] overflow-hidden -z-10">
        <div className="absolute -top-16 -right-24 w-80 h-80 rounded-full bg-rosa-300/35 blur-3xl animate-deriva" />
        <div className="absolute top-72 -left-28 w-72 h-72 rounded-full bg-rosa-200/50 blur-3xl animate-deriva"
             style={{ animationDelay: '-7s' }} />
      </div>

      {d.portada === 'completa'
        ? <PortadaCompleta n={n} cargando={qNegocio.isLoading} cerrado={cerrado} ubicacion={ubicacion} />
        : <>
            <header className="relative flex justify-center pt-5 pb-4 animate-pagina">
              <BotonTema className="absolute right-4 top-4" />
              <Logo n={n} />
            </header>
            <PortadaTarjeta n={n} cargando={qNegocio.isLoading} cerrado={cerrado} ubicacion={ubicacion} />
          </>}

      {cerrado && (
        <div className="px-4 mt-4">
          <Aviso tipo="aviso">{t('inicio.cerrado', {}, n.closed_message)}</Aviso>
        </div>
      )}

      {d.secciones.filter(s => s.visible).map(s => <Fragment key={s.id}>{SECCIONES[s.id]}</Fragment>)}

      <p className="text-center mt-6">
        <Link to="/politicas" className="text-[13px] text-tinta-tenue underline underline-offset-2 inline-block min-h-[44px] leading-[44px]
                                         hover:text-rosa-700 transition-colors">
          {t('inicio.enlace_politicas')}
        </Link>
      </p>
    </div>
  )
}

// ---------- Logo (el que sube Lynn o el de siempre) ----------
function Logo({ n, claro = false }: { n?: Negocio; claro?: boolean }) {
  const sombra = claro ? 'drop-shadow-[0_2px_10px_rgba(0,0,0,.45)]' : ''
  if (n?.logo_url) {
    return <img src={n.logo_url} alt={n.name} crossOrigin="anonymous" className={`h-12 w-auto max-w-[220px] object-contain ${sombra}`} />
  }
  return (
    <picture>
      <source srcSet={`${BASE}logo-horizontal-rosa.webp`} type="image/webp" />
      <img src={`${BASE}logo-horizontal-rosa.png`} alt="Nails by Lynn" width={101} height={44} className={`h-11 w-auto ${sombra}`} />
    </picture>
  )
}

// ---------- Foto de portada ----------
function FotoPortada({ n, cargando }: { n?: Negocio; cargando: boolean }) {
  if (cargando) return <div className="absolute inset-0 reflejo" />
  if (n?.hero_image_url) {
    return <img src={n.hero_image_url} alt="Lynn en su estudio de uñas" crossOrigin="anonymous"
                className="absolute inset-0 w-full h-full object-cover" {...{ fetchpriority: 'high' }} />
  }
  // En móvil, recorte vertical ya encuadrado (32 KB); en pantallas anchas, la foto completa
  return (
    <picture>
      <source media="(min-width: 640px)" srcSet={`${BASE}hero-lynn.webp`} type="image/webp" />
      <source srcSet={`${BASE}hero-lynn-movil.webp`} type="image/webp" />
      <img src={`${BASE}hero-lynn.jpg`} alt="Lynn en su estudio de uñas"
           className="absolute inset-0 w-full h-full object-cover object-[60%_center]"
           {...{ fetchpriority: 'high' }} />{/* React 18 solo pasa el atributo en minúsculas */}
    </picture>
  )
}

function Destellos() {
  const d = useDiseno()
  if (!d.destellos) return null
  return (
    <div aria-hidden className="absolute inset-0 text-white pointer-events-none">
      <IconoDestellos tam={22} className="absolute top-[12%] right-[14%] animate-centelleo" />
      <IconoDestellos tam={14} className="absolute top-[24%] right-[30%] animate-centelleo" style={espera(900)} />
      <IconoDestellos tam={16} className="absolute top-[40%] left-[10%] animate-centelleo" style={espera(1700)} />
      <IconoDestellos tam={12} className="absolute top-[18%] left-[34%] animate-centelleo" style={espera(2300)} />
    </div>
  )
}

/** Degradado que oscurece la foto bajo el texto (cuánto, lo decide Lynn) */
function Velo() {
  const { oscurecer } = useDiseno()
  const a = (0.35 + oscurecer / 100 * 0.6).toFixed(2)
  return <div className="absolute inset-0"
              style={{ background: `radial-gradient(circle at 12% 8%, rgb(var(--rosa-500) / .30), transparent 48%),`
                + `linear-gradient(to bottom, rgba(20,10,16,0) 30%, rgba(20,10,16,${a}) 100%)` }} />
}

function TextoPortada({ cerrado, ubicacion, grande = false }: { cerrado: boolean; ubicacion: string; grande?: boolean }) {
  const t = useTextos()
  const titulo = t('inicio.titulo')
  return (
    <>
      <span className="inline-block text-[11px] font-semibold tracking-[0.2em] uppercase animate-pagina
                       bg-white/15 backdrop-blur px-3 py-1 rounded-full border border-white/25" style={espera(250)}>
        {t('inicio.etiqueta', { ubicacion })}
      </span>
      {/* Frase sobre la foto solo si Lynn escribe una en «Textos de la web» */}
      {titulo
        ? <h1 className={`font-display leading-[1.05] mt-3 ${grande ? 'text-[44px]' : 'text-[34px]'}`}>
            <TextoLetras texto={titulo} retraso={350} />
          </h1>
        : <h1 className="sr-only">Nails by Lynn</h1>}
      {!cerrado && (
        <div className={`mt-5 flex gap-2.5 ${grande ? 'flex-col' : ''}`}>
          <Link to="/reservar" className={`${estiloBoton('primario', true)} brillo group animate-pagina`} style={espera(550)}>
            {t('inicio.boton_reservar')}
            <IconoFlecha tam={18} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          {grande && (
            <a href="#servicios" className="toque min-h-[48px] rounded-boton border border-white/35 bg-white/10 backdrop-blur
                                             text-white font-semibold inline-flex items-center justify-center gap-2 animate-pagina
                                             hover:bg-white/20 transition" style={espera(700)}>
              Ver servicios y precios
            </a>
          )}
        </div>
      )}
    </>
  )
}

// Portada en tarjeta: se acerca al abrir, baja más despacio al hacer scroll y se inclina hacia el dedo
function PortadaTarjeta({ n, cargando, cerrado, ubicacion }: { n?: Negocio; cargando: boolean; cerrado: boolean; ubicacion: string }) {
  const capa = useParalaje<HTMLDivElement>(0.12, 56)   // la capa sobresale un 16 % por arriba
  const tarjeta = useInclinacion<HTMLDivElement>(5)
  return (
    <section className="px-4">
      <div className="animate-ampliar">
        <div ref={tarjeta} className="viva overflow-hidden rounded-xl shadow-lg aspect-[4/5] sm:aspect-[16/10] ring-1 ring-rosa-200/60">
          <div ref={capa} className="absolute inset-x-0 -top-[16%] bottom-0 will-change-transform">
            <div className="absolute inset-0 animate-acercar"><FotoPortada n={n} cargando={cargando} /></div>
          </div>
          <Velo />
          <Destellos />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white">
            <TextoPortada cerrado={cerrado} ubicacion={ubicacion} />
          </div>
        </div>
      </div>
    </section>
  )
}

// Portada a pantalla completa: foto inmersiva con aurora de color y una hoja que sube sobre ella
function PortadaCompleta({ n, cargando, cerrado, ubicacion }: { n?: Negocio; cargando: boolean; cerrado: boolean; ubicacion: string }) {
  const capa = useParalaje<HTMLDivElement>(0.35, 170)
  return (
    <>
      <section className="relative h-[88svh] min-h-[540px] max-h-[900px] overflow-hidden bg-noche text-white">
        <div ref={capa} className="absolute inset-x-0 -top-[22%] bottom-0 will-change-transform">
          <div className="absolute inset-0 animate-acercar"><FotoPortada n={n} cargando={cargando} /></div>
        </div>
        <div className="aurora" aria-hidden />
        <Velo />
        <Destellos />
        <header className="absolute inset-x-0 top-0 flex justify-center pt-5 animate-pagina">
          <BotonTema className="absolute right-4 top-4" />
          <Logo n={n} claro />
        </header>
        <div className="absolute inset-x-0 bottom-0 px-6 pb-14">
          <TextoPortada cerrado={cerrado} ubicacion={ubicacion} grande />
        </div>
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <a href="#servicios" aria-label="Bajar" className="text-white/80 animate-bounce p-1">
            <IconoFlecha tam={22} className="rotate-90" />
          </a>
        </div>
      </section>
      {/* La hoja que «sube» sobre la foto */}
      <div aria-hidden className="relative -mt-6 h-6 rounded-t-[28px] bg-superficie-base" />
    </>
  )
}

// ---------- Horario y lugar ----------
function DatosRapidos({ ubicacion }: { ubicacion: string }) {
  const horario = useHorarioPublico()
  const t = useTextos()
  const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return (
    <section className="px-4 mt-4 grid grid-cols-2 gap-3">
      {[
        { icono: <IconoReloj tam={19} />, titulo: horario.dias ? mayus(horario.dias) : t('inicio.horario_titulo'),
          texto: horario.turnos || t('inicio.horario_texto') },
        { icono: <IconoUbicacion tam={19} />, titulo: ubicacion, texto: t('inicio.ubicacion_texto') },
      ].map((x, i) => (
        <Revelar key={i} retraso={i * 120}
          className="bg-papel/90 backdrop-blur rounded-lg border border-rosa-100/80 p-3.5 flex items-start gap-2.5 shadow-sm">
          <span className="w-8 h-8 rounded-full bg-gradient-to-br from-rosa-50 to-rosa-100 text-rosa-600 flex items-center justify-center shrink-0">
            {x.icono}
          </span>
          <div className="text-[13px] leading-snug">
            <div className="font-semibold">{x.titulo}</div>
            <div className="text-tinta-tenue">{x.texto}</div>
          </div>
        </Revelar>
      ))}
    </section>
  )
}

// ---------- Cinta: dos franjas cruzadas con los servicios que pasan sin parar ----------
function Cinta({ servicios }: { servicios: Servicio[] }) {
  if (servicios.length === 0) return null
  const nombres = servicios.map(s => s.name.replace(/^\P{L}+/u, '').trim())   // sin el emoji del principio
  const fila = (clave: string) => nombres.map((nom, i) => (
    <span key={`${clave}${i}`} className="inline-flex items-center gap-4 px-4 whitespace-nowrap">
      {nom}<span aria-hidden className="opacity-70">✦</span>
    </span>
  ))
  return (
    <section aria-label="Servicios" className="cinta relative overflow-hidden py-9 mt-8">
      <div className="absolute inset-x-[-10%] top-1/2 -translate-y-1/2 rotate-[3deg] bg-rosa-100 text-rosa-800 py-2.5
                      text-[13px] font-semibold uppercase tracking-[0.18em]" aria-hidden>
        <div className="cinta-pista" style={{ animationDirection: 'reverse', animationDuration: '40s' }}>{fila('a')}{fila('b')}</div>
      </div>
      <div className="relative mx-[-10%] -rotate-2 bg-gradient-to-r from-rosa-600 via-rosa-500 to-vino text-white py-3 shadow-lg
                      font-display text-[22px]">
        <div className="cinta-pista">{fila('c')}{fila('d')}</div>
      </div>
    </section>
  )
}

// ---------- Servicios ----------
function Servicios({ q }: { q: UseQueryResult<Servicio[]> }) {
  const t = useTextos()
  return (
    <section id="servicios" className="px-4 mt-10 scroll-mt-4">
      <TituloSeccion etiqueta={t('inicio.servicios_etiqueta')} titulo={t('inicio.servicios_titulo') || undefined}
        extra={<span className="text-[13px] text-tinta-tenue pb-1">{t('inicio.servicios_ayuda')}</span>} className="mb-5" />
      <div className="space-y-3">
        {q.isLoading && Array.from({ length: 3 }).map((_, i) => <Esqueleto key={i} className="h-24" />)}
        {q.isError && <Aviso>{mensajeDeError(q.error)}</Aviso>}
        {q.data && q.data.length === 0 && (
          <p className="text-[14px] text-tinta-tenue bg-papel rounded-lg border border-rosa-100 p-4">{t('inicio.sin_servicios')}</p>
        )}
        {q.data?.map((s, i) => (
          <Revelar key={s.id} retraso={Math.min(i, 4) * 90}><TarjetaServicio s={s} /></Revelar>
        ))}
      </div>
    </section>
  )
}

function TarjetaServicio({ s }: { s: Servicio }) {
  const ref = useInclinacion<HTMLAnchorElement>(6)
  return (
    <Link ref={ref} to={`/reservar?servicio=${s.slug}`}
      className="viva toque group block bg-papel rounded-xl border border-rosa-100/80 shadow-suave p-4
                 hover:shadow-brillo hover:border-rosa-200">
      <div className="relative flex items-center gap-4">
        {s.cover_image_url && (
          <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-rosa-50">
            <img src={s.cover_image_url} alt={s.name} loading="lazy" crossOrigin="anonymous"
                 className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" />
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
          <span className="font-display text-[22px] text-rosa-700 text-right">
            {dinero(Number(s.price))}
            <EnCup min={Number(s.price)} />
          </span>
          <span className="w-9 h-9 rounded-full bg-rosa-50 text-rosa-600 flex items-center justify-center
                           transition duration-300 group-hover:bg-rosa-600 group-hover:text-white group-hover:shadow-boton group-hover:-rotate-45">
            <IconoFlecha tam={17} />
          </span>
        </div>
      </div>
    </Link>
  )
}

// ---------- Galería destacada: collage con las favoritas (o las últimas) ----------
function GaleriaDestacada() {
  const q = useQuery({ queryKey: ['fotos'], queryFn: obtenerFotosPublicas, staleTime: 30 * 60_000 })
  const todas = q.data ?? []
  const favoritas = todas.filter(f => f.is_featured)
  const fotos = (favoritas.length >= 3 ? favoritas : [...favoritas, ...todas.filter(f => !f.is_featured)]).slice(0, 5)
  if (fotos.length < 2) return null
  return (
    <section className="px-4 mt-14">
      <TituloSeccion etiqueta="Mis trabajos" titulo="Recién salidas del estudio" className="mb-5"
        extra={<Link to="/galeria" className="text-[13px] font-semibold text-rosa-700 pb-1 whitespace-nowrap hover:underline">Ver todo →</Link>} />
      {/* La primera ocupa dos filas; las demás llenan el resto sin dejar huecos */}
      <div className="grid grid-cols-2 auto-rows-[9.5rem] gap-2.5">
        {fotos.map((f, i) => (
          <Revelar key={f.id} efecto="cortina" retraso={i * 110}
            className={`relative overflow-hidden rounded-lg bg-rosa-100 shadow-sm ${i === 0 ? 'row-span-2' : ''}
                        ${fotos.length === 2 && i === 1 ? 'row-span-2' : ''} ${fotos.length === 4 && i === 3 ? 'col-span-2' : ''}`}>
            <Link to="/galeria" className="group block w-full h-full" aria-label={f.alt_text ?? 'Ver la galería'}>
              <img src={f.thumbnail_url ?? f.image_url} alt={f.alt_text ?? 'Trabajo de Nails by Lynn'} loading="lazy" crossOrigin="anonymous"
                   className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" />
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-noche/35 via-transparent to-transparent
                                           opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </Link>
          </Revelar>
        ))}
      </div>
    </section>
  )
}

// ---------- Cómo funciona ----------
function Pasos() {
  const t = useTextos()
  const horario = useHorarioPublico()
  const [ref, vistos] = useVisto<HTMLOListElement>()
  const PASOS = [
    { titulo: t('inicio.paso1_titulo'), texto: t('inicio.paso1_texto') },
    { titulo: t('inicio.paso2_titulo'), texto: horario.turnos ? t('inicio.paso2_texto', { turnos: horario.turnos }) : 'Elige el turno que prefieras.' },
    { titulo: t('inicio.paso3_titulo'), texto: t('inicio.paso3_texto') },
  ]
  return (
    <section className="px-4 mt-14">
      <TituloSeccion etiqueta={t('inicio.pasos_etiqueta')} titulo={t('inicio.pasos_titulo')} className="mb-5" />
      <ol ref={ref} className="relative space-y-3">
        {/* Hilo que une los tres pasos y se dibuja al llegar */}
        <span aria-hidden className={`absolute left-9 top-8 bottom-8 w-0.5 -ml-px origin-top rounded-full
                                       bg-gradient-to-b from-rosa-500 via-rosa-300 to-rosa-200
                                       ${vistos ? 'animate-trazo' : 'scale-y-0'}`} />
        {PASOS.map((p, i) => (
          <Revelar como="li" key={i} retraso={150 + i * 160} efecto="derecha"
            className="relative flex items-center gap-4 bg-papel rounded-lg border border-rosa-100/80 p-4 shadow-sm">
            <span className={`w-10 h-10 rounded-full bg-gradient-to-br from-rosa-500 to-vino text-white shadow-boton
                              font-display text-[18px] flex items-center justify-center shrink-0
                              ${vistos ? 'animate-pop' : 'opacity-0'}`}
                  style={espera(250 + i * 160)}>{i + 1}</span>
            <div>
              <div className="font-semibold text-[15px]">{p.titulo}</div>
              <div className="text-[13px] text-tinta-tenue">{p.texto}</div>
            </div>
          </Revelar>
        ))}
      </ol>
    </section>
  )
}

// ---------- Contacto ----------
function Contacto({ n, cerrado, ubicacion }: { n: Negocio; cerrado: boolean; ubicacion: string }) {
  const t = useTextos()
  return (
    <section className="px-4 mt-14">
      <Revelar efecto="escala" className="rounded-xl bg-noche text-white p-6 relative overflow-hidden shadow-lg">
        <div className="aurora opacity-70" aria-hidden />
        <IconoDestellos tam={18} aria-hidden className="absolute top-6 right-6 text-acento animate-centelleo" />
        <span className="relative"><Etiqueta><span className="text-acento">{t('inicio.contacto_etiqueta')}</span></Etiqueta></span>
        <h2 className="relative text-[28px] leading-tight mt-2">{t('inicio.contacto_titulo')}</h2>
        <p className="relative text-white/75 text-[14px] mt-2">{t('inicio.contacto_texto', { ubicacion })}</p>
        <div className="mt-5 space-y-2.5 relative">
          {n.phone_whatsapp && (
            <a href={`https://wa.me/${numeroWhatsApp(n.phone_whatsapp)}`} target="_blank" rel="noreferrer"
               onClick={() => registrarEvento('whatsapp')}
               className="brillo toque min-h-[52px] w-full rounded-boton bg-whatsapp text-white font-semibold
                          inline-flex items-center justify-center gap-2 transition duration-200
                          shadow-[0_10px_24px_-10px_rgba(37,211,102,.7)] hover:-translate-y-0.5 hover:bg-whatsapp-oscuro active:scale-[0.98]">
              <IconoWhatsApp tam={20} /> {t('inicio.boton_whatsapp')}
            </a>
          )}
          {!cerrado && (
            <Link to="/reservar"
              className="toque min-h-[52px] w-full rounded-boton border border-white/30 text-white font-semibold
                         inline-flex items-center justify-center gap-2 transition duration-200
                         hover:bg-white/10 hover:border-white/50 active:scale-[0.98]">
              <IconoCalendario tam={19} /> {t('inicio.boton_reservar')}
            </Link>
          )}
        </div>
      </Revelar>
    </section>
  )
}
