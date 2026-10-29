import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { obtenerFotosPublicas, obtenerServicios, type FotoPublica } from '../lib/api'
import { Esqueleto, Aviso, Vacio, Etiqueta } from '../componentes/ui'
import { IconoCerrar, IconoAtras } from '../componentes/iconos'
import { mensajeDeError } from '../lib/errores'
import { useTextos } from '../lib/textos'
import { Revelar, Subrayado } from '../componentes/Movimiento'

type Visor = { lista: FotoPublica[]; i: number; dir: 1 | -1 }

export default function Galeria() {
  const qFotos = useQuery({ queryKey: ['fotos'], queryFn: obtenerFotosPublicas })
  const qServ = useQuery({ queryKey: ['servicios'], queryFn: obtenerServicios })
  const [params] = useSearchParams()
  // Desde la reserva («Ver fotos de este trabajo») llega ya filtrada por servicio
  const [filtro, setFiltro] = useState<string | null>(params.get('servicio'))
  const [visor, setVisor] = useState<Visor | null>(null)
  const t = useTextos()

  const filtradas = useMemo(() => {
    const todas = qFotos.data ?? []
    return filtro ? todas.filter(f => f.service_id === filtro) : todas
  }, [qFotos.data, filtro])
  const destacadas = (qFotos.data ?? []).filter(f => f.is_featured).slice(0, 6)
  // Solo los servicios que tienen alguna foto
  const conFotos = new Set((qFotos.data ?? []).map(f => f.service_id))
  const filtros = (qServ.data ?? []).filter(s => conFotos.has(s.id))

  const abrir = (lista: FotoPublica[], i: number) => setVisor({ lista, i, dir: 1 })

  return (
    <div className="pb-28">
      <section className="px-4 pt-8 pb-5">
        <Etiqueta>{t('galeria.etiqueta')}</Etiqueta>
        <h1 className="text-[38px] leading-tight mt-1 linea-mascara"><span>{t('galeria.titulo')}</span></h1>
        <Subrayado className="text-rosa-400 subrayado visible" />
        <p className="text-tinta-tenue mt-2 text-[15px] animate-pagina" style={{ animationDelay: '200ms' }}>
          {t('galeria.texto')}
          {qFotos.data && qFotos.data.length > 0 && <span className="text-rosa-700 font-semibold"> · {qFotos.data.length} trabajos</span>}
        </p>
      </section>

      {qFotos.isLoading && (
        <div className="px-4 columns-2 gap-2.5">
          {[180, 240, 200, 160, 260, 190].map((h, i) => <Esqueleto key={i} className="mb-2.5 break-inside-avoid" style={{ height: h }} />)}
        </div>
      )}

      {qFotos.isError && <div className="px-4"><Aviso>{mensajeDeError(qFotos.error)}</Aviso></div>}

      {qFotos.data && qFotos.data.length === 0 && (
        <div className="px-4"><Vacio titulo={t('galeria.vacio_titulo')} texto={t('galeria.vacio_texto')} /></div>
      )}

      {qFotos.data && qFotos.data.length > 0 && (
        <>
          {destacadas.length > 0 && !filtro && (
            <section className="mb-6">
              <div className="px-4 mb-3"><Etiqueta>{t('galeria.favoritas')}</Etiqueta></div>
              <div className="flex gap-3 px-4 overflow-x-auto sin-scrollbar snap-x snap-mandatory pb-2">
                {destacadas.map((f, i) => (
                  <Revelar key={f.id} efecto="derecha" retraso={i * 120} className="w-[70%] shrink-0 snap-start">
                    <button onClick={() => abrir(destacadas, i)} aria-label={`Ampliar: ${f.alt_text ?? 'trabajo destacado'}`}
                      className="toque group relative block w-full aspect-[4/5] overflow-hidden rounded-xl bg-rosa-100 shadow-suave
                                 active:scale-[0.98] transition duration-200">
                      <img src={f.thumbnail_url ?? f.image_url} alt={f.alt_text ?? 'Trabajo destacado'}
                           loading="lazy" crossOrigin="anonymous"
                           className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
                      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-noche/50 via-transparent to-transparent" />
                      <span aria-hidden className="absolute bottom-3 left-3 text-[11px] font-semibold tracking-[0.18em] uppercase text-white
                                                   bg-white/15 backdrop-blur px-2.5 py-1 rounded-full border border-white/25">★ Favorita</span>
                    </button>
                  </Revelar>
                ))}
              </div>
            </section>
          )}

          {filtros.length > 0 && (
            <section className="mb-4 overflow-x-auto sin-scrollbar">
              <div className="px-4 flex gap-2 pb-1">
                {[{ id: null, name: 'Todas' }, ...filtros].map(s => {
                  const activo = filtro === s.id
                  return (
                    <button key={s.id ?? 'todas'} onClick={() => setFiltro(s.id)} aria-pressed={activo}
                      className={`toque min-h-[40px] px-4 rounded-full text-[13px] font-medium whitespace-nowrap transition duration-300 active:scale-95
                        ${activo ? 'bg-gradient-to-br from-rosa-600 to-vino text-white shadow-boton'
                                 : 'bg-papel border border-rosa-200 text-tinta-suave hover:border-rosa-400'}`}>
                      {s.name}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {filtradas.length === 0 && filtro && (
            <div className="px-4"><Vacio titulo="Sin fotos de este servicio" texto="Prueba con otra categoría." /></div>
          )}

          {/* Mosaico: cada foto con su altura; key: al cambiar de filtro vuelven a entrar en cascada */}
          <div key={filtro ?? 'todas'} className="px-4 columns-2 gap-2.5">
            {filtradas.map((f, i) => (
              <Revelar key={f.id} efecto="escala" retraso={(i % 6) * 70} className="mb-2.5 break-inside-avoid">
                <button onClick={() => abrir(filtradas, i)} aria-label={`Ampliar: ${f.alt_text ?? 'trabajo'}`}
                  className="toque block w-full overflow-hidden rounded-lg bg-rosa-100 relative group min-h-[120px]
                             shadow-sm hover:shadow-brillo active:scale-[0.97] transition duration-300">
                  <img src={f.thumbnail_url ?? f.image_url} alt={f.alt_text ?? 'Trabajo'} loading="lazy" crossOrigin="anonymous"
                       className="w-full h-auto block transition-transform duration-700 ease-out group-hover:scale-110" />
                  <span aria-hidden className="absolute inset-0 bg-rosa-900/0 group-hover:bg-rosa-900/10 transition-colors duration-300" />
                </button>
              </Revelar>
            ))}
          </div>
        </>
      )}

      {visor && <VisorFotos visor={visor} setVisor={setVisor} />}
    </div>
  )
}

// Visor a pantalla completa: deslizar con el dedo o flechas para pasar de foto; Escape o tocar fuera para cerrar
function VisorFotos({ visor, setVisor }: { visor: Visor; setVisor: (v: Visor | null) => void }) {
  const { lista, i, dir } = visor
  const foto = lista[i]
  const botonCerrar = useRef<HTMLButtonElement>(null)
  const inicioX = useRef<number | null>(null)
  const [arrastre, setArrastre] = useState(0)

  const ir = (paso: 1 | -1) => {
    if (lista.length < 2) return
    setVisor({ lista, i: (i + paso + lista.length) % lista.length, dir: paso })
  }

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    const desbordeAntes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    botonCerrar.current?.focus()
    return () => { document.body.style.overflow = desbordeAntes; anterior?.focus?.() }
  }, [])

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisor(null)
      if (e.key === 'ArrowRight') setVisor({ lista, i: (i + 1) % lista.length, dir: 1 })
      if (e.key === 'ArrowLeft') setVisor({ lista, i: (i - 1 + lista.length) % lista.length, dir: -1 })
    }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [lista, i, setVisor])

  const flecha = 'absolute top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition'

  return (
    <div role="dialog" aria-modal="true" aria-label="Foto ampliada" onClick={() => setVisor(null)}
         className="fixed inset-0 z-50 bg-noche/95 backdrop-blur-md flex flex-col animate-entrada">
      <div className="flex items-center justify-between px-4 pt-4 text-white/80 text-[14px]" onClick={e => e.stopPropagation()}>
        <span className="tabular-nums">{i + 1} / {lista.length}</span>
        <button ref={botonCerrar} onClick={() => setVisor(null)} aria-label="Cerrar"
          className="w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 hover:rotate-90 transition duration-300">
          <IconoCerrar />
        </button>
      </div>

      <div className="relative flex-1 flex items-center justify-center p-4 touch-pan-y select-none"
           onPointerDown={e => { inicioX.current = e.clientX }}
           onPointerMove={e => { if (inicioX.current !== null) setArrastre(e.clientX - inicioX.current) }}
           onPointerUp={e => {
             const dx = inicioX.current === null ? 0 : e.clientX - inicioX.current
             inicioX.current = null; setArrastre(0)
             if (Math.abs(dx) > 50) { e.stopPropagation(); ir(dx < 0 ? 1 : -1) }
           }}
           onPointerCancel={() => { inicioX.current = null; setArrastre(0) }}>
        <img key={foto.id} src={foto.image_url} alt={foto.alt_text ?? ''} crossOrigin="anonymous" draggable={false}
             onClick={e => e.stopPropagation()}
             className={`max-w-full max-h-full object-contain rounded-lg shadow-lg ${dir === 1 ? 'animate-paso-adelante' : 'animate-paso-atras'}`}
             style={arrastre ? { transform: `translateX(${arrastre}px) rotate(${arrastre / 40}deg)`, transition: 'none' } : undefined} />
        {lista.length > 1 && (
          <>
            <button aria-label="Foto anterior" onClick={e => { e.stopPropagation(); ir(-1) }} className={`${flecha} left-3 hidden sm:flex`}>
              <IconoAtras />
            </button>
            <button aria-label="Foto siguiente" onClick={e => { e.stopPropagation(); ir(1) }} className={`${flecha} right-3 hidden sm:flex`}>
              <IconoAtras className="rotate-180" />
            </button>
          </>
        )}
      </div>

      <div className="px-6 pb-[max(20px,env(safe-area-inset-bottom))] text-center" onClick={e => e.stopPropagation()}>
        {foto.caption && <p className="text-white/85 text-[15px] mb-3">{foto.caption}</p>}
        {lista.length > 1 && (
          <div className="flex justify-center gap-1.5" aria-hidden>
            {lista.slice(0, 12).map((f, k) => (
              <span key={f.id} className={`h-1.5 rounded-full transition-all duration-300 ${k === i ? 'w-5 bg-white' : 'w-1.5 bg-white/35'}`} />
            ))}
          </div>
        )}
        {lista.length > 1 && <p className="text-white/50 text-[12px] mt-2 sm:hidden">Desliza para ver más</p>}
      </div>
    </div>
  )
}
