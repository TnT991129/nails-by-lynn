import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { obtenerFotosPublicas, obtenerServicios } from '../lib/api'
import { Esqueleto, Aviso, Vacio, Etiqueta } from '../componentes/ui'
import { IconoCerrar } from '../componentes/iconos'
import { mensajeDeError } from '../lib/errores'
import { useTextos } from '../lib/textos'
import { Revelar } from '../componentes/Movimiento'

export default function Galeria() {
  const qFotos = useQuery({ queryKey:['fotos'], queryFn: obtenerFotosPublicas })
  const qServ  = useQuery({ queryKey:['servicios'], queryFn: obtenerServicios })
  const [params] = useSearchParams()
  // Desde la reserva («Ver fotos de este trabajo») llega ya filtrada por servicio
  const [filtro, setFiltro] = useState<string | null>(params.get('servicio'))
  const [ampliada, setAmpliada] = useState<string | null>(null)
  const t = useTextos()

  const filtradas = useMemo(() => {
    const todas = qFotos.data ?? []
    if (!filtro) return todas
    return todas.filter(f => f.service_id === filtro)
  }, [qFotos.data, filtro])

  const destacadas = (qFotos.data ?? []).filter(f => f.is_featured).slice(0, 4)

  // Visor abierto: se cierra con Escape, la página de detrás no se mueve y el foco va al botón de cerrar
  const botonCerrar = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!ampliada) return
    const anterior = document.activeElement as HTMLElement | null
    const alPulsar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAmpliada(null) }
    const desbordeAntes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', alPulsar)
    botonCerrar.current?.focus()
    return () => {
      document.removeEventListener('keydown', alPulsar)
      document.body.style.overflow = desbordeAntes
      anterior?.focus?.()
    }
  }, [ampliada])

  return (
    <div className="pb-28">
      <section className="px-4 pt-8 pb-5">
        <Etiqueta>{t('galeria.etiqueta')}</Etiqueta>
        <h1 className="text-[34px] leading-tight mt-1 linea-mascara"><span>{t('galeria.titulo')}</span></h1>
        <p className="text-tinta-tenue mt-1.5 text-[15px] animate-pagina" style={{ animationDelay: '200ms' }}>{t('galeria.texto')}</p>
      </section>

      {qFotos.isLoading && (
        <div className="px-4 grid grid-cols-2 gap-2.5">
          {Array.from({length:6}).map((_,i) => (
            <Esqueleto key={i} className="aspect-square" />
          ))}
        </div>
      )}

      {qFotos.isError && <div className="px-4"><Aviso>{mensajeDeError(qFotos.error)}</Aviso></div>}

      {qFotos.data && qFotos.data.length === 0 && (
        <div className="px-4">
          <Vacio titulo={t('galeria.vacio_titulo')} texto={t('galeria.vacio_texto')} />
        </div>
      )}

      {qFotos.data && qFotos.data.length > 0 && (
        <>
          {destacadas.length > 0 && !filtro && (
            <section className="mb-6">
              <div className="px-4 mb-3">
                <Etiqueta>{t('galeria.favoritas')}</Etiqueta>
              </div>
              <div className="flex gap-3 px-4 overflow-x-auto sin-scrollbar snap-x snap-mandatory">
                {destacadas.map((f, i) => (
                  <Revelar key={f.id} efecto="derecha" retraso={i * 120} className="w-[70%] shrink-0 snap-start">
                    <button onClick={() => setAmpliada(f.image_url)} aria-label={`Ampliar: ${f.alt_text ?? 'trabajo destacado'}`}
                      className="group relative block w-full aspect-[4/5] overflow-hidden rounded-xl bg-rosa-100 shadow-suave
                                 active:scale-[0.98] transition duration-200">
                      <img src={f.thumbnail_url ?? f.image_url}
                           alt={f.alt_text ?? 'Trabajo destacado'}
                           loading="lazy" crossOrigin="anonymous"
                           className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
                      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-noche/40 via-transparent to-transparent" />
                      <span aria-hidden className="absolute bottom-3 left-3 text-[11px] font-semibold tracking-[0.18em] uppercase text-white
                                                   bg-white/15 backdrop-blur px-2.5 py-1 rounded-full border border-white/25">★ Favorita</span>
                    </button>
                  </Revelar>
                ))}
              </div>
            </section>
          )}

          {qServ.data && qServ.data.length > 0 && (
            <section className="mb-4 overflow-x-auto sin-scrollbar">
              <div className="px-4 flex gap-2 pb-1">
                <button onClick={() => setFiltro(null)}
                  className={`min-h-[40px] px-4 rounded-full text-[13px] font-medium whitespace-nowrap transition duration-200 active:scale-95
                    ${!filtro ? 'bg-noche text-white shadow-md' : 'bg-papel border border-rosa-200 text-tinta-suave hover:border-rosa-400'}`}>
                  Todas
                </button>
                {qServ.data.map(s => (
                  <button key={s.id} onClick={() => setFiltro(s.id)}
                    className={`min-h-[40px] px-4 rounded-full text-[13px] font-medium whitespace-nowrap transition duration-200 active:scale-95
                      ${filtro === s.id ? 'bg-noche text-white shadow-md' : 'bg-papel border border-rosa-200 text-tinta-suave hover:border-rosa-400'}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          {filtradas.length === 0 && filtro && (
            <div className="px-4">
              <Vacio titulo="Sin fotos de este servicio"
                texto="Prueba con otra categoría." />
            </div>
          )}

          {/* key: al cambiar de filtro las fotos vuelven a entrar en cascada */}
          <div key={filtro ?? 'todas'} className="grid grid-cols-2 gap-2.5 px-4">
            {filtradas.map((f, i) => (
              <Revelar key={f.id} efecto="escala" retraso={(i % 6) * 70}>
                <button onClick={() => setAmpliada(f.image_url)} aria-label={`Ampliar: ${f.alt_text ?? 'trabajo'}`}
                  className="block w-full aspect-square overflow-hidden rounded-lg bg-rosa-100 relative group
                             shadow-sm hover:shadow-lg active:scale-[0.97] transition duration-200">
                  <img src={f.thumbnail_url ?? f.image_url}
                       alt={f.alt_text ?? 'Trabajo'}
                       loading="lazy" crossOrigin="anonymous"
                       className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" />
                  <span aria-hidden className="absolute inset-0 bg-rosa-900/0 group-hover:bg-rosa-900/10 transition-colors duration-300" />
                </button>
              </Revelar>
            ))}
          </div>
        </>
      )}

      {/* Visor de foto ampliada */}
      {ampliada && (
        <div onClick={() => setAmpliada(null)} role="dialog" aria-modal="true" aria-label="Foto ampliada"
             className="fixed inset-0 bg-noche/95 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-entrada">
          <img src={ampliada} alt="" crossOrigin="anonymous"
               className="max-w-full max-h-full object-contain rounded-lg shadow-lg animate-ampliar" />
          <button ref={botonCerrar} onClick={() => setAmpliada(null)} aria-label="Cerrar"
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 text-white
                       flex items-center justify-center hover:bg-white/25 hover:rotate-90 transition duration-300">
            <IconoCerrar />
          </button>
        </div>
      )}
    </div>
  )
}
