import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerPortada, cambiarPortada, registrarErrorSubida } from '../../lib/panel/api-panel'
import { urlPublica } from '../../lib/panel/whatsapp'
import { Boton, Tarjeta, Aviso, Esqueleto } from '../../componentes/ui'
import { mensajeDeErrorSubida } from '../../lib/errores'
import { Volver } from './comunes'

// Lynn cambia la foto grande de arriba de la web de las clientas
export default function PortadaWeb() {
  const qc = useQueryClient()
  const entrada = useRef<HTMLInputElement>(null)
  const q = useQuery({ queryKey: ['portada'], queryFn: obtenerPortada })
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)
  const BASE = import.meta.env.BASE_URL

  async function cambiar(archivo: File | null) {
    if (!archivo && !confirm('¿Volver a poner la foto de siempre?')) return
    setTrabajando(true); setError(null); setHecho(false)
    try {
      await cambiarPortada(archivo)
      qc.invalidateQueries({ queryKey: ['portada'] })
      qc.invalidateQueries({ queryKey: ['negocio'] })
      setHecho(true)
    } catch (e) {
      setError(mensajeDeErrorSubida(e))
      if (archivo) registrarErrorSubida('portada', e, archivo)
    } finally {
      setTrabajando(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  const propia = q.data ?? null
  return (
    <div className="p-5 space-y-4">
      <Volver />
      <div>
        <h1 className="text-[30px] leading-tight">Portada de la web</h1>
        <p className="text-[14px] text-tinta-tenue mt-1">
          La foto grande que ven las clientas al abrir la web. Queda mejor una foto vertical;
          la parte de abajo se oscurece un poco para que se lea el texto.
        </p>
      </div>

      {q.isLoading && <Esqueleto className="aspect-[4/5]" />}
      {q.isError && <Aviso>{mensajeDeErrorSubida(q.error)}</Aviso>}

      {!q.isLoading && (
        <Tarjeta className="space-y-3">
          <div className="relative overflow-hidden rounded-lg aspect-[4/5] bg-rosa-100">
            <img src={propia ?? `${BASE}hero-lynn-movil.webp`} alt="Foto de portada actual"
                 crossOrigin={propia ? 'anonymous' : undefined}
                 className={`absolute inset-0 w-full h-full object-cover ${propia ? '' : 'object-[60%_center]'}`} />
            <span className="absolute top-2 left-2 text-[11px] font-semibold bg-black/55 text-white rounded-full px-2.5 py-1">
              {propia ? 'Tu foto' : 'Foto de siempre'}
            </span>
          </div>

          <input ref={entrada} type="file" accept="image/*" className="hidden"
                 onChange={e => e.target.files?.[0] && cambiar(e.target.files[0])} />
          <Boton ancho cargando={trabajando} onClick={() => entrada.current?.click()}>📷 Cambiar foto</Boton>
          {propia && (
            <Boton ancho variante="secundario" disabled={trabajando} onClick={() => cambiar(null)}>
              Volver a la foto de siempre
            </Boton>
          )}
          {error && <Aviso>{error}</Aviso>}
          {hecho && (
            <p className="text-[14px] text-estado-exito text-center">
              ✓ Listo. <a href={urlPublica()} target="_blank" rel="noreferrer" className="underline">Ver la web</a>
            </p>
          )}
        </Tarjeta>
      )}
    </div>
  )
}
