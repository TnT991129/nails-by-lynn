import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { obtenerFotosPublicas, obtenerServicios } from '../lib/api'
import { Esqueleto, Aviso, Vacio, Etiqueta } from '../componentes/ui'
import { IconoCerrar } from '../componentes/iconos'
import { mensajeDeError } from '../lib/errores'

export default function Galeria() {
  const qFotos = useQuery({ queryKey:['fotos'], queryFn: obtenerFotosPublicas })
  const qServ  = useQuery({ queryKey:['servicios'], queryFn: obtenerServicios })
  const [filtro, setFiltro] = useState<string | null>(null)
  const [ampliada, setAmpliada] = useState<string | null>(null)

  const filtradas = useMemo(() => {
    const todas = qFotos.data ?? []
    if (!filtro) return todas
    return todas.filter(f => f.service_id === filtro)
  }, [qFotos.data, filtro])

  const destacadas = (qFotos.data ?? []).filter(f => f.is_featured).slice(0, 4)

  return (
    <div className="pb-28">
      <section className="px-4 pt-8 pb-5">
        <Etiqueta>Portafolio</Etiqueta>
        <h1 className="text-[34px] leading-tight mt-1">Galería</h1>
        <p className="text-tinta-tenue mt-1.5 text-[15px]">
          Los últimos trabajos, hechos con mucho cariño.
        </p>
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
          <Vacio titulo="Aún no hay fotos"
            texto="Pronto tendremos los primeros trabajos aquí." />
        </div>
      )}

      {qFotos.data && qFotos.data.length > 0 && (
        <>
          {destacadas.length > 0 && !filtro && (
            <section className="mb-6">
              <div className="px-4 mb-3">
                <Etiqueta>Favoritas</Etiqueta>
              </div>
              <div className="flex gap-3 px-4 overflow-x-auto sin-scrollbar snap-x snap-mandatory">
                {destacadas.map(f => (
                  <button key={f.id} onClick={() => setAmpliada(f.image_url)}
                    className="w-[70%] shrink-0 snap-start aspect-[4/5] overflow-hidden rounded-xl bg-rosa-100 shadow-suave">
                    <img src={f.thumbnail_url ?? f.image_url}
                         alt={f.alt_text ?? 'Trabajo destacado'}
                         loading="lazy"
                         className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {qServ.data && qServ.data.length > 0 && (
            <section className="mb-4 overflow-x-auto sin-scrollbar">
              <div className="px-4 flex gap-2 pb-1">
                <button onClick={() => setFiltro(null)}
                  className={`min-h-[40px] px-4 rounded-full text-[13px] font-medium whitespace-nowrap transition
                    ${!filtro ? 'bg-tinta text-white' : 'bg-white border border-rosa-200 text-tinta-suave'}`}>
                  Todas
                </button>
                {qServ.data.map(s => (
                  <button key={s.id} onClick={() => setFiltro(s.id)}
                    className={`min-h-[40px] px-4 rounded-full text-[13px] font-medium whitespace-nowrap transition
                      ${filtro === s.id ? 'bg-tinta text-white' : 'bg-white border border-rosa-200 text-tinta-suave'}`}>
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

          <div className="grid grid-cols-2 gap-2.5 px-4">
            {filtradas.map(f => (
              <button key={f.id} onClick={() => setAmpliada(f.image_url)}
                className="aspect-square overflow-hidden rounded-lg bg-rosa-100 relative group">
                <img src={f.thumbnail_url ?? f.image_url}
                     alt={f.alt_text ?? 'Trabajo'}
                     loading="lazy"
                     className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </>
      )}

      {/* Visor de foto ampliada */}
      {ampliada && (
        <div onClick={() => setAmpliada(null)}
             className="fixed inset-0 bg-tinta/95 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-entrada">
          <img src={ampliada} alt=""
               className="max-w-full max-h-full object-contain rounded-lg" />
          <button onClick={() => setAmpliada(null)} aria-label="Cerrar"
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 text-white
                       flex items-center justify-center">
            <IconoCerrar />
          </button>
        </div>
      )}
    </div>
  )
}
