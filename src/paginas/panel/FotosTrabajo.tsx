import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fotosDeClienta, subirFotoTrabajo } from '../../lib/panel/api-panel'
import { Tarjeta, Aviso, Boton } from '../../componentes/ui'
import { fechaLarga } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'

// Fotos de los diseños que Lynn le hizo a la clienta. Son privadas: no salen en la galería
// pública hasta que Lynn las publique desde Galería (y solo con permiso de la clienta).
export default function FotosTrabajo({ clientId, titulo = 'Sus diseños' }: { clientId: string; titulo?: string }) {
  const qc = useQueryClient()
  const entrada = useRef<HTMLInputElement>(null)
  const q = useQuery({ queryKey: ['fotos-clienta', clientId], queryFn: () => fotosDeClienta(clientId) })
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ampliada, setAmpliada] = useState<string | null>(null)

  async function subir(archivo: File) {
    setSubiendo(true); setError(null)
    try {
      await subirFotoTrabajo(clientId, archivo)
      qc.invalidateQueries({ queryKey: ['fotos-clienta', clientId] })
      qc.invalidateQueries({ queryKey: ['fotos-panel'] })
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setSubiendo(false); if (entrada.current) entrada.current.value = '' }
  }

  const fotos = q.data ?? []
  return (
    <Tarjeta className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[14px] text-tinta-tenue">{titulo}</div>
        <input ref={entrada} type="file" accept="image/*" className="hidden"
               onChange={e => e.target.files?.[0] && subir(e.target.files[0])} />
        <Boton variante="secundario" cargando={subiendo} onClick={() => entrada.current?.click()}
               className="!min-h-[38px] !px-4 !text-[13px]">📷 Añadir foto</Boton>
      </div>
      {fotos.length === 0 && !q.isLoading && (
        <p className="text-[13px] text-tinta-tenue">Haz una foto al terminar: la próxima vez sabrás qué diseño llevaba.</p>
      )}
      {fotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {fotos.map(f => (
            <button key={f.id} onClick={() => setAmpliada(f.image_url)} className="relative aspect-square">
              <img src={f.image_url} alt="" loading="lazy" crossOrigin="anonymous"
                   className="w-full h-full object-cover rounded-lg bg-rosa-50" />
              <span className="absolute bottom-1 left-1 right-1 text-[10px] text-white bg-black/50 rounded px-1 truncate">
                {fechaLarga(f.created_at).replace(/^\w+ /, '')}
              </span>
            </button>
          ))}
        </div>
      )}
      {error && <Aviso>{error}</Aviso>}
      {ampliada && (
        <button onClick={() => setAmpliada(null)} aria-label="Cerrar"
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <img src={ampliada} alt="" crossOrigin="anonymous" className="max-w-full max-h-full rounded-lg" />
        </button>
      )}
    </Tarjeta>
  )
}
