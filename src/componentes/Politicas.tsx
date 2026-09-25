import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { obtenerPoliticas } from '../lib/api'
import type { Politicas } from '../lib/tipos'
import { Esqueleto, Aviso } from './ui'
import { IconoCerrar } from './iconos'
import { mensajeDeError } from '../lib/errores'

type Seccion = { titulo: string; texto: string }

const horas = (n: number) => (n === 1 ? '1 hora' : `${n} horas`)

// Si Lynn no escribió un texto propio, se explica la regla que aplica el sistema (nunca se inventan reglas)
function secciones(p: Politicas): Seccion[] {
  const t = p.textos
  const lista: (Seccion | null)[] = [
    { titulo: 'Reservas', texto:
      `Puedes tener hasta ${p.max_citas_activas} citas próximas a la vez y reservar con hasta ${p.max_dias_antelacion} días de antelación. ` +
      'Tu reserva queda guardada al confirmar; avisa a Lynn por WhatsApp para que te tenga presente.' },
    { titulo: 'Cancelaciones', texto: t.cancelacion ??
      `Puedes cancelar desde el enlace de tu cita hasta ${horas(p.cancelar_minimo_horas)} antes. ` +
      'Si ya no llegas a tiempo, escríbeme por WhatsApp.' },
    { titulo: 'Cambios de fecha u hora', texto: t.cambios ??
      `Puedes cambiar tu cita hasta ${horas(p.cambiar_minimo_horas)} antes, ` +
      `un máximo de ${p.max_cambios} ${p.max_cambios === 1 ? 'vez' : 'veces'} por cita.` },
    p.anticipo ? { titulo: 'Anticipo', texto: t.anticipo ??
      `Algunas citas requieren un anticipo. Si cancelas con más de ${horas(p.cancelar_gratis_horas)} de antelación, se devuelve.` } : null,
    t.no_show ? { titulo: 'Si no asistes', texto: t.no_show } : null,
    t.retrasos ? { titulo: 'Retrasos', texto: t.retrasos } : null,
    t.reembolsos ? { titulo: 'Reembolsos', texto: t.reembolsos } : null,
    t.espera ? { titulo: 'Tiempo de espera', texto: t.espera } : null,
    { titulo: 'Privacidad', texto: t.privacidad ??
      'Tu nombre y teléfono solo se usan para gestionar tus citas y escribirte sobre ellas. No se comparten con nadie.' },
  ]
  return lista.filter((s): s is Seccion => s !== null)
}

export function ContenidoPoliticas() {
  const q = useQuery({ queryKey: ['politicas'], queryFn: obtenerPoliticas, staleTime: 10 * 60_000 })
  if (q.isLoading) return <div className="space-y-3"><Esqueleto className="h-20" /><Esqueleto className="h-20" /></div>
  if (q.isError) return <Aviso>{mensajeDeError(q.error)}</Aviso>
  return (
    <div className="space-y-5">
      {secciones(q.data!).map(s => (
        <section key={s.titulo}>
          <h3 className="text-[15px] font-semibold text-rosa-800">{s.titulo}</h3>
          <p className="text-[14px] text-tinta-suave mt-1 whitespace-pre-line leading-relaxed">{s.texto}</p>
        </section>
      ))}
    </div>
  )
}

/** Enlace discreto que abre las políticas en una ventana, sin salir de la página */
export function EnlacePoliticas({ texto = 'políticas del estudio', className = '' }: { texto?: string; className?: string }) {
  const [abierta, setAbierta] = useState(false)

  useEffect(() => {
    if (!abierta) return
    const alPulsar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierta(false) }
    window.addEventListener('keydown', alPulsar)
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', alPulsar); document.body.style.overflow = anterior }
  }, [abierta])

  return (
    <>
      <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); setAbierta(true) }}
        className={`text-rosa-800 underline underline-offset-2 font-medium ${className}`}>
        {texto}
      </button>
      {abierta && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-tinta/50 animate-entrada"
             onClick={() => setAbierta(false)} role="dialog" aria-modal="true" aria-label="Políticas del estudio">
          <div onClick={e => e.stopPropagation()}
               className="bg-white w-full sm:max-w-lg rounded-t-xl sm:rounded-xl max-h-[85dvh] flex flex-col shadow-lg">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-rosa-100">
              <h2 className="text-[22px]">Políticas del estudio</h2>
              <button onClick={() => setAbierta(false)} aria-label="Cerrar"
                      className="w-11 h-11 rounded-full flex items-center justify-center text-tinta-suave hover:bg-rosa-50">
                <IconoCerrar />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-5 pb-[max(20px,env(safe-area-inset-bottom))]">
              <ContenidoPoliticas />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
