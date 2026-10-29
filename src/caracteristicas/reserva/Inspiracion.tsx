import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { enviarInspiracion, contarInspiracion } from '../../lib/api'
import { IconoCerrar, IconoCheck } from '../../componentes/iconos'

// Foto de inspiración: la clienta enseña el diseño que quiere (de Instagram, Pinterest…) para que Lynn
// calcule tiempo y material. Va a un almacén privado: solo Lynn la ve (supabase/inspiracion_fidelidad_visitas.sql).

const MAX_FOTOS = 3

/** Recuadro para elegir la foto en la reserva (se envía al confirmar, en la página de la cita) */
export function SelectorInspiracion({ foto, setFoto }: { foto: File | null; setFoto: (f: File | null) => void }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [vista, setVista] = useState<string | null>(null)
  useEffect(() => {
    if (!foto) { setVista(null); return }
    const url = URL.createObjectURL(foto)
    setVista(url)
    return () => URL.revokeObjectURL(url)
  }, [foto])

  return (
    <div>
      <span className="block text-[14px] font-medium text-tinta-suave mb-1.5">¿Tienes una foto del diseño que quieres? (opcional)</span>
      <input ref={entrada} type="file" accept="image/*" className="hidden"
             onChange={e => { const f = e.target.files?.[0]; if (f) setFoto(f); e.target.value = '' }} />
      {vista ? (
        <div className="relative w-32 aspect-square rounded-lg overflow-hidden border border-rosa-200 animate-pop">
          <img src={vista} alt="Tu foto de inspiración" className="w-full h-full object-cover" />
          <button type="button" onClick={() => setFoto(null)} aria-label="Quitar la foto"
                  className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-noche/70 text-white flex items-center justify-center">
            <IconoCerrar tam={16} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => entrada.current?.click()}
          className="toque w-full min-h-[72px] rounded-lg border-2 border-dashed border-rosa-200 bg-rosa-50/50 text-rosa-800
                     flex items-center justify-center gap-2 text-[15px] font-medium hover:border-rosa-400 transition">
          <span aria-hidden className="text-[22px]">📷</span> Añadir foto de inspiración
        </button>
      )}
      <span className="block text-[13px] text-tinta-tenue mt-1.5">Así sé cuánto tiempo y material necesito. Solo la veo yo.</span>
    </div>
  )
}

/** En la página de la cita: envía la foto elegida al reservar y deja añadir más mientras la cita esté activa */
export function InspiracionCita({ token, activa, pendiente, enlaceWhatsApp }: {
  token: string; activa: boolean; pendiente?: File | null; enlaceWhatsApp?: string | null
}) {
  const qc = useQueryClient()
  const entrada = useRef<HTMLInputElement>(null)
  const q = useQuery({ queryKey: ['inspiracion', token], queryFn: () => contarInspiracion(token) })
  const [estado, setEstado] = useState<'quieto' | 'enviando' | 'hecho' | 'error'>('quieto')
  const enviada = useRef(false)

  async function enviar(f: File) {
    setEstado('enviando')
    try {
      await enviarInspiracion(token, f)
      setEstado('hecho')
      qc.invalidateQueries({ queryKey: ['inspiracion', token] })
    } catch { setEstado('error') }
  }

  // La que eligió al reservar se envía una sola vez al llegar aquí
  useEffect(() => {
    if (pendiente && !enviada.current) { enviada.current = true; enviar(pendiente) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al llegar desde la reserva
  }, [pendiente])

  const total = q.data
  if (total === null || total === undefined) return null   // sin el SQL o cargando: no se muestra nada
  if (!activa && total === 0) return null

  return (
    <div className="rounded-xl border border-rosa-100 bg-papel p-4 flex items-center gap-3 shadow-suave">
      <span aria-hidden className="w-11 h-11 rounded-full bg-rosa-50 flex items-center justify-center text-[20px] shrink-0">
        {estado === 'enviando' ? <span className="w-5 h-5 border-2 border-rosa-600 border-t-transparent rounded-full animate-spin" /> : '📷'}
      </span>
      <div className="flex-1 min-w-0 text-[14px]">
        {estado === 'enviando' && <span className="text-tinta-suave">Enviando tu foto de inspiración…</span>}
        {estado === 'error' && (
          <span className="text-estado-error">
            No se pudo enviar la foto.{' '}
            {enlaceWhatsApp && <a href={enlaceWhatsApp} target="_blank" rel="noreferrer" className="underline">Mándamela por WhatsApp</a>}
          </span>
        )}
        {estado !== 'enviando' && estado !== 'error' && (total > 0
          ? <span className="inline-flex items-center gap-1.5 text-estado-exito font-medium">
              <IconoCheck tam={15} strokeWidth={2.6} /> {total === 1 ? 'Tengo tu foto de inspiración' : `Tengo tus ${total} fotos de inspiración`}
            </span>
          : <span className="text-tinta-suave">¿Quieres enseñarme el diseño que te gusta?</span>)}
      </div>
      {activa && total < MAX_FOTOS && estado !== 'enviando' && (
        <>
          <input ref={entrada} type="file" accept="image/*" className="hidden"
                 onChange={e => { const f = e.target.files?.[0]; if (f) enviar(f); e.target.value = '' }} />
          <button onClick={() => entrada.current?.click()} className="text-[14px] font-semibold text-rosa-800 min-h-[44px] px-2 shrink-0">
            {total > 0 ? 'Añadir otra' : 'Añadir foto'}
          </button>
        </>
      )}
    </div>
  )
}
