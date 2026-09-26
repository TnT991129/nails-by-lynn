import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Boton, Tarjeta, Aviso } from '../../componentes/ui'
import { armarMensaje, enlaceWhatsApp, ETIQUETAS, type PlantillaKey } from '../../lib/panel/whatsapp'
import { notifsDeCita, registrarEnvio, type CitaAgenda } from '../../lib/panel/api-panel'
import { mensajeDeError } from '../../lib/errores'
import { hora } from '../../lib/formato'

// Devuelve la plantilla sugerida según el estado y el tiempo hasta la cita
function plantillaSugerida(c: CitaAgenda): PlantillaKey | null {
  const ahora = Date.now()
  const inicio = new Date(c.starts_at).getTime()
  const horas = (inicio - ahora) / 3_600_000

  if (c.status === 'CONFIRMADA' || c.status === 'PENDIENTE') {
    if (horas > 20 && horas < 30) return 'recordatorio'  // ventana de 24h ± 4-6h
    if (horas < 2 && horas > -1)  return 'retraso'
  }
  return null
}

export default function BloqueMensajes({ cita, tokenAcceso }: {
  cita: CitaAgenda; tokenAcceso: string;
}) {
  const qc = useQueryClient()
  const [enviando, setEnviando] = useState<PlantillaKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const q = useQuery({
    queryKey: ['notifs', cita.id],
    queryFn: () => notifsDeCita(cita.id),
  })

  const enviados = new Set(q.data?.filter(n => n.status === 'ENVIADA').map(n => n.template_key) ?? [])
  const sugerida = plantillaSugerida(cita)

  async function abrir(clave: PlantillaKey) {
    setEnviando(clave); setError(null)
    try {
      const datos = {
        cliente_nombre: cita.cliente_nombre,
        starts_at: cita.starts_at,
        servicios: cita.servicios ?? '',
        total_amount: Number(cita.total_amount),
        currency: cita.currency,
        code: cita.code,
        access_token: tokenAcceso,
      }
      const mensaje = armarMensaje(clave, datos)
      const url = enlaceWhatsApp(cita.cliente_telefono, mensaje)

      // Marcamos como enviado ANTES de abrir WhatsApp, porque a veces el navegador
      // no vuelve al panel y perderíamos el registro.
      await registrarEnvio(cita.id, clave, mensaje, cita.cliente_telefono)
      qc.invalidateQueries({ queryKey: ['notifs', cita.id] })

      // Abrir WhatsApp en pestaña nueva
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setEnviando(null)
    }
  }

  const teclas: PlantillaKey[] = ['recordatorio','retraso']

  return (
    <Tarjeta className="space-y-3">
      <div className="text-[14px] text-tinta-tenue">Mensajes por WhatsApp</div>
      {error && <Aviso>{error}</Aviso>}

      {sugerida && !enviados.has(sugerida) && (
        <div className="p-3 rounded bg-rosa-50 border border-rosa-200 space-y-2">
          <div className="text-[13px] text-rosa-900">
            💡 Sugerido ahora: <b>{ETIQUETAS[sugerida].titulo}</b>
          </div>
          <Boton ancho onClick={() => abrir(sugerida)} cargando={enviando === sugerida}>
            {ETIQUETAS[sugerida].icono} {ETIQUETAS[sugerida].titulo}
          </Boton>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2">
        {teclas.map(k => {
          const enviado = enviados.has(k)
          return (
            <button key={k} onClick={() => abrir(k)}
              disabled={enviando !== null}
              className={`p-3 rounded border text-left min-h-[64px] disabled:opacity-60
                ${enviado ? 'border-rosa-200 bg-rosa-50/50' : 'border-rosa-200 bg-white'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium">{ETIQUETAS[k].icono} {ETIQUETAS[k].titulo}</span>
                {enviado && <span className="text-[11px] text-rosa-700">✓</span>}
              </div>
              <div className="text-[11px] text-tinta-tenue mt-0.5">{ETIQUETAS[k].descripcion}</div>
            </button>
          )
        })}
      </div>

      {q.data && q.data.filter(n => n.status === 'ENVIADA').length > 0 && (
        <details className="text-[13px]">
          <summary className="text-tinta-tenue cursor-pointer">Historial de envíos</summary>
          <ul className="mt-2 space-y-1 pl-2">
            {q.data.filter(n => n.status === 'ENVIADA').map(n => (
              <li key={n.id} className="text-tinta-suave">
                {ETIQUETAS[n.template_key as PlantillaKey]?.titulo ?? n.template_key}
                {n.sent_at && ` · ${hora(n.sent_at)}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Tarjeta>
  )
}
