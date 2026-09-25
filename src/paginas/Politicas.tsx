import { Etiqueta } from '../componentes/ui'
import { ContenidoPoliticas } from '../componentes/Politicas'

// Página propia (/politicas) para poder compartir el enlace
export default function Politicas() {
  return (
    <div className="pb-28">
      <section className="px-4 pt-8 pb-5">
        <Etiqueta>Nails by Lynn</Etiqueta>
        <h1 className="text-[34px] leading-tight mt-1">Políticas del estudio</h1>
      </section>
      <div className="px-4">
        <div className="bg-white rounded-xl border border-rosa-100/80 shadow-suave p-5">
          <ContenidoPoliticas />
        </div>
      </div>
    </div>
  )
}
