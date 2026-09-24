import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { obtenerFotosPublicas, obtenerServicios } from '../lib/api'
import { Esqueleto, Aviso, Vacio, Etiqueta } from '../componentes/ui'
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
    <div className="pb-24">
      <section className="px-5 pt-8 pb-4">
        <h1 className="font-display text-[30px]">Galería</h1>
        <p className="text-tinta-suave mt-2 text-[14px]">
          Los últimos trabajos hechos con mucho cariño 💖
        </p>
      </section>

      {qFotos.isLoading && (
        <div className="px-5 grid grid-cols-2 gap-2">
          {Array.from({length:6}).map((_,i) => (
            <Esqueleto key={i} className="aspect-square" />
          ))}
        </div>
      )}

      {qFotos.isError && <div className="px-5"><Aviso>{mensajeDeError(qFotos.error)}</Aviso></div>}

      {qFotos.data && qFotos.data.length === 0 && (
        <div className="px-5">
          <Vacio titulo="Aún no hay fotos"
            texto="Pronto tendremos los primeros trabajos aquí." />
        </div>
      )}

      {qFotos.data && qFotos.data.length > 0 && (
        <>
          {destacadas.length > 0 && !filtro && (
            <section className="mb-6">
              <div className="px-5 mb-3">
                <Etiqueta>Favoritas</Etiqueta>
              </div>
              <div className="grid grid-cols-2 gap-2 px-5">
                {destacadas.map(f => (
                  <button key={f.id} onClick={() => setAmpliada(f.image_url)}
                    className="aspect-square overflow-hidden rounded-sm bg-rosa-100">
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
            <section className="mb-4 overflow-x-auto">
              <div className="px-5 flex gap-2 pb-1">
                <button onClick={() => setFiltro(null)}
                  className={`min-h-[36px] px-4 rounded-full text-[13px] whitespace-nowrap
                    ${!filtro ? 'bg-rosa-600 text-white' : 'bg-white border border-rosa-200 text-tinta-suave'}`}>
                  Todas
                </button>
                {qServ.data.map(s => (
                  <button key={s.id} onClick={() => setFiltro(s.id)}
                    className={`min-h-[36px] px-4 rounded-full text-[13px] whitespace-nowrap
                      ${filtro === s.id ? 'bg-rosa-600 text-white' : 'bg-white border border-rosa-200 text-tinta-suave'}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          {filtradas.length === 0 && filtro && (
            <div className="px-5">
              <Vacio titulo="Sin fotos de este servicio"
                texto="Prueba con otra categoría." />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 px-5">
            {filtradas.map(f => (
              <button key={f.id} onClick={() => setAmpliada(f.image_url)}
                className="aspect-square overflow-hidden rounded-sm bg-rosa-100 relative group">
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
             className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 animate-entrada">
          <img src={ampliada} alt=""
               className="max-w-full max-h-full object-contain rounded-sm" />
          <button onClick={() => setAmpliada(null)}
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/20 text-white text-[24px]
                       flex items-center justify-center">
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
