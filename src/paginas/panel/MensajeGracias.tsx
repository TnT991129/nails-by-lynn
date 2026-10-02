import { useQuery, useQueryClient } from '@tanstack/react-query'
import { notifsDeCita, registrarEnvio, type CitaAgenda } from '../../lib/panel/api-panel'
import { armarMensaje, enlaceWhatsApp } from '../../lib/panel/whatsapp'
import { Tarjeta } from '../../componentes/ui'
import { IconoWhatsApp } from '../../componentes/iconos'

// Tras completar la cita: agradecimiento con el enlace para que la clienta deje su valoración
export default function MensajeGracias({ cita, tokenAcceso }: { cita: CitaAgenda; tokenAcceso: string }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['notifs', cita.id], queryFn: () => notifsDeCita(cita.id) })
  const enviado = (q.data ?? []).some(n => n.template_key === 'gracias' && n.status === 'ENVIADA')

  async function enviar() {
    const mensaje = armarMensaje('gracias', {
      cliente_nombre: cita.cliente_nombre, starts_at: cita.starts_at, servicios: cita.servicios ?? '',
      total_amount: Number(cita.total_amount), currency: cita.currency, code: cita.code, access_token: tokenAcceso,
    })
    window.open(enlaceWhatsApp(cita.cliente_telefono, mensaje), '_blank', 'noopener,noreferrer')
    try { await registrarEnvio(cita.id, 'gracias', mensaje, cita.cliente_telefono) } catch { /* solo es una marca */ }
    qc.invalidateQueries({ queryKey: ['notifs', cita.id] })
  }

  return (
    <Tarjeta className="space-y-2">
      <div className="text-[14px] text-tinta-tenue">Después de la cita</div>
      <button onClick={enviar}
        className="w-full min-h-[52px] rounded-full bg-whatsapp text-white font-semibold text-[15px]
                   flex items-center justify-center gap-2 active:scale-[0.98] transition">
        <IconoWhatsApp tam={20} /> {enviado ? 'Volver a enviar las gracias' : 'Dar las gracias y pedir su opinión'}
      </button>
      {enviado && <p className="text-[12px] text-tinta-tenue text-center">✓ Ya se lo enviaste</p>}
    </Tarjeta>
  )
}
