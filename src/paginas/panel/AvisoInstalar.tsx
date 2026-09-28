import { useState } from 'react'
import { useInstalar, yaInstalada, esIPhone } from '../../lib/panel/instalar'
import { Boton } from '../../componentes/ui'
import { IconoCerrar, IconoDescarga } from '../../componentes/iconos'

const CLAVE = 'nbl.panel.instalar-pospuesto'
const DIAS_SIN_AVISAR = 3

function pospuesto(): boolean {
  try {
    const t = Number(localStorage.getItem(CLAVE) ?? 0)
    return Date.now() - t < DIAS_SIN_AVISAR * 86_400_000
  } catch { return false }
}

// Aviso flotante al abrir el panel en el móvil para instalarlo como app.
// No aparece en el ordenador, si ya está instalada, ni durante 3 días tras "Ahora no".
export default function AvisoInstalar() {
  const { puedeInstalar, instalar } = useInstalar()
  const [oculto, setOculto] = useState(() =>
    yaInstalada() || pospuesto() || !window.matchMedia('(pointer: coarse)').matches)
  if (oculto) return null

  function ahoraNo() {
    try { localStorage.setItem(CLAVE, String(Date.now())) } catch { /* sin almacenamiento: solo esta vez */ }
    setOculto(true)
  }

  const iphone = esIPhone()
  return (
    <div role="dialog" aria-label="Instalar el panel"
         className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+80px)] z-30 max-w-md mx-auto
                    rounded-xl bg-noche text-white shadow-lg p-4 animate-entrada">
      <button onClick={ahoraNo} aria-label="Cerrar"
              className="absolute top-1.5 right-1.5 w-10 h-10 rounded-full flex items-center justify-center text-white/70">
        <IconoCerrar tam={18} />
      </button>
      <div className="flex gap-3 items-start pr-8">
        <img src={`${import.meta.env.BASE_URL}icono-panel-192.png`} alt="" width={48} height={48}
             className="w-12 h-12 rounded-lg shrink-0" />
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">Instala el panel en tu móvil</div>
          <div className="text-[13px] text-white/75">Ábrelo como una app, directo a tu agenda.</div>
        </div>
      </div>

      {puedeInstalar ? (
        <div className="flex gap-2 mt-3">
          <button onClick={ahoraNo} className="flex-1 min-h-[44px] rounded-full border border-white/25 text-[14px]">
            Ahora no
          </button>
          <Boton onClick={async () => { if (await instalar()) setOculto(true) }}
                 className="flex-1 !min-h-[44px] !px-3 !text-[14px]">
            <IconoDescarga tam={17} /> Instalar
          </Boton>
        </div>
      ) : (
        <>
          <p className="text-[13px] text-white/90 mt-3">
            {iphone
              ? <>En <b>Safari</b>: toca <b>Compartir</b> (el cuadrado con la flecha ↑) y luego <b>«Añadir a pantalla de inicio»</b>.</>
              : <>En <b>Chrome</b>: abre el menú <b>⋮</b> (arriba a la derecha) y toca <b>«Instalar aplicación»</b> o <b>«Añadir a pantalla de inicio»</b>.</>}
          </p>
          <button onClick={ahoraNo} className="w-full min-h-[44px] mt-2 rounded-full border border-white/25 text-[14px]">
            Entendido
          </button>
        </>
      )}
    </div>
  )
}
