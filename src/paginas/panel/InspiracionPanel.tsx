import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { inspiracionDeCita } from '../../lib/panel/api-panel'
import { Tarjeta } from '../../componentes/ui'
import { IconoCerrar } from '../../componentes/iconos'

// Fotos del diseño que quiere la clienta (las adjunta al reservar o desde su cita). Si no hay, no sale nada.
export default function InspiracionPanel({ citaId }: { citaId: string }) {
  const q = useQuery({ queryKey: ['inspiracion-panel', citaId], queryFn: () => inspiracionDeCita(citaId), staleTime: 30 * 60_000 })
  const [ampliada, setAmpliada] = useState<string | null>(null)
  if (!q.data?.length) return null
  return (
    <Tarjeta>
      <div className="text-[15px] font-semibold">📷 Diseño que quiere</div>
      <p className="text-[13px] text-tinta-tenue">Fotos de inspiración que te mandó la clienta.</p>
      <div className="flex gap-2 mt-3 overflow-x-auto sin-scrollbar">
        {q.data.map(f => (
          <button key={f.id} onClick={() => setAmpliada(f.url)} className="w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-rosa-50">
            <img src={f.url} alt="Inspiración de la clienta" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      {ampliada && (
        <div role="dialog" aria-modal="true" onClick={() => setAmpliada(null)}
             className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 animate-entrada">
          <img src={ampliada} alt="Inspiración de la clienta" className="max-w-full max-h-full object-contain rounded-lg" />
          <button aria-label="Cerrar" className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center">
            <IconoCerrar />
          </button>
        </div>
      )}
    </Tarjeta>
  )
}
