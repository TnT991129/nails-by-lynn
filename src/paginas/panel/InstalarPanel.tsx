import { useState } from 'react'
import { useInstalar, yaInstalada, esIPhone } from '../../lib/panel/instalar'
import { Boton } from '../../componentes/ui'
import { IconoDescarga } from '../../componentes/iconos'

// Tarjeta para instalar el panel como app en el móvil. No aparece si ya se abrió como app.
export default function InstalarPanel() {
  const { puedeInstalar, instalar } = useInstalar()
  const [instalada, setInstalada] = useState(false)
  if (yaInstalada() || instalada) return null

  const iphone = esIPhone()
  return (
    <div className="rounded-xl bg-noche text-white p-4 flex gap-3 items-start">
      <img src={`${import.meta.env.BASE_URL}icono-panel-192.png`} alt="" width={48} height={48}
           className="w-12 h-12 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div>
          <div className="text-[15px] font-semibold">Instala el panel en tu móvil</div>
          <div className="text-[13px] text-white/75">Se abre como una app, sin barra del navegador y directo a tu agenda.</div>
        </div>
        {puedeInstalar ? (
          <Boton onClick={async () => setInstalada(await instalar())}
                 className="!min-h-[44px] !px-4 !text-[14px]">
            <IconoDescarga tam={17} /> Instalar app
          </Boton>
        ) : iphone ? (
          <p className="text-[13px] text-white/90">
            En <b>Safari</b>: toca <b>Compartir</b> (el cuadrado con la flecha ↑) y luego
            <b> «Añadir a pantalla de inicio»</b>.
          </p>
        ) : (
          <p className="text-[13px] text-white/90">
            En <b>Chrome</b>: abre el menú <b>⋮</b> y toca <b>«Instalar aplicación»</b> o
            <b> «Añadir a pantalla de inicio»</b>.
          </p>
        )}
      </div>
    </div>
  )
}
