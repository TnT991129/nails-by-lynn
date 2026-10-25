import { Etiqueta } from '../componentes/ui'
import { ContenidoPoliticas } from '../componentes/Politicas'
import { useTextos } from '../lib/textos'

// Página propia (/politicas) para poder compartir el enlace
export default function Politicas() {
  const t = useTextos()
  return (
    <div className="pb-28">
      <section className="px-4 pt-8 pb-5">
        <Etiqueta>{t('politicas.etiqueta')}</Etiqueta>
        <h1 className="text-[34px] leading-tight mt-1">{t('politicas.titulo')}</h1>
      </section>
      <div className="px-4">
        <div className="bg-papel rounded-xl border border-rosa-100/80 shadow-suave p-5">
          <ContenidoPoliticas />
        </div>
      </div>
    </div>
  )
}
