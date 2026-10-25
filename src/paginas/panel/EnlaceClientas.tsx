import { useState } from 'react'
import { Tarjeta } from '../../componentes/ui'
import { urlPublica } from '../../lib/panel/whatsapp'

// El enlace que Lynn pasa a las clientas para reservar: a mano para copiarlo o compartirlo
export default function EnlaceClientas() {
  const enlace = `${urlPublica()}reservar`
  const [copiado, setCopiado] = useState(false)
  const puedeCompartir = typeof navigator !== 'undefined' && 'share' in navigator

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace)
    } catch {
      // Navegadores sin portapapeles: se copia con un campo temporal
      const t = document.createElement('textarea')
      t.value = enlace
      document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove()
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function compartir() {
    try {
      await navigator.share({ title: 'Nails by Lynn', text: 'Reserva tu cita aquí 💅', url: enlace })
    } catch { /* se cerró el menú de compartir sin elegir nada */ }
  }

  return (
    <Tarjeta className="space-y-2.5">
      <div className="text-[14px] text-tinta-tenue">Enlace para tus clientas</div>
      <a href={enlace} target="_blank" rel="noreferrer"
         className="block text-[15px] font-medium text-rosa-800 underline underline-offset-2 break-all">
        {enlace}
      </a>
      <div className={`grid gap-2 ${puedeCompartir ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button onClick={copiar}
          className="min-h-[44px] rounded-full border border-rosa-200 bg-papel text-[14px] font-semibold text-tinta-suave">
          {copiado ? '✓ Copiado' : 'Copiar enlace'}
        </button>
        {puedeCompartir && (
          <button onClick={compartir}
            className="min-h-[44px] rounded-full bg-rosa-600 text-white text-[14px] font-semibold">
            Compartir
          </button>
        )}
      </div>
    </Tarjeta>
  )
}
