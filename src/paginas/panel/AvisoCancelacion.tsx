import { useQuery, useQueryClient } from '@tanstack/react-query'
import { notifsDeCita, registrarEnvio, type CitaAgenda } from '../../lib/panel/api-panel'
import { armarMensaje, enlaceWhatsApp } from '../../lib/panel/whatsapp'
import { IconoWhatsApp, IconoCheck } from '../../componentes/iconos'
import { fechaLarga, hora } from '../../lib/formato'

// Tras cancelar Lynn una cita: avisar a la clienta por WhatsApp con el mensaje ya escrito
export default function AvisoCancelacion({ cita, tokenAcceso, motivo }: {
  cita: CitaAgenda; tokenAcceso: string; motivo: string | null
}) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['notifs', cita.id], queryFn: () => notifsDeCita(cita.id) })
  const avisada = q.data?.some(n => n.template_key === 'cancelacion' && n.status === 'ENVIADA') ?? false
  const nombre = cita.cliente_nombre.trim().split(/\s+/)[0]

  const mensaje = armarMensaje('cancelacion', {
    cliente_nombre: cita.cliente_nombre,
    starts_at: cita.starts_at,
    servicios: cita.servicios ?? '',
    total_amount: Number(cita.total_amount),
    currency: cita.currency,
    code: cita.code,
    access_token: tokenAcceso,
    motivo,
  })

  // Se abre con un enlace normal (el navegador no lo bloquea) y se registra el envío a la vez
  function registrar() {
    registrarEnvio(cita.id, 'cancelacion', mensaje, cita.cliente_telefono)
      .then(() => qc.invalidateQueries({ queryKey: ['notifs', cita.id] }))
      .catch(() => {})
  }

  return (
    <div className={`rounded-xl border-2 p-4 space-y-3
                     ${avisada ? 'border-rosa-100 bg-white' : 'border-[#25D366] bg-[#E9FBF0]'}`}>
      {avisada ? (
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-estado-exito">
          <IconoCheck tam={16} strokeWidth={2.6} /> Clienta avisada de la cancelación
        </span>
      ) : (
        <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#25D366] text-white text-[11px] font-bold uppercase tracking-wider">
          Falta avisar a la clienta
        </span>
      )}
      {!avisada && (
        <p className="text-[14px] text-tinta leading-snug">
          Avísale a <b>{nombre}</b> que su cita del {fechaLarga(cita.starts_at)} a las {hora(cita.starts_at)} queda
          cancelada. El mensaje ya va escrito{motivo ? ', con el motivo' : ''} y le ofrece reservar otro turno.
        </p>
      )}
      <a href={enlaceWhatsApp(cita.cliente_telefono, mensaje)} target="_blank" rel="noreferrer" onClick={registrar}
         className={`w-full min-h-[52px] rounded-full px-4 flex items-center justify-center gap-2 font-semibold
                     active:scale-[0.98] transition
                     ${avisada ? 'border border-[#25D366] text-[#128C4A] bg-white text-[15px]'
                               : 'bg-[#25D366] text-white text-[16px] shadow-[0_10px_24px_-10px_rgba(37,211,102,.7)]'}`}>
        <IconoWhatsApp tam={20} />
        {avisada ? 'Enviar otra vez' : `Avisar a ${nombre} por WhatsApp`}
      </a>
    </div>
  )
}
