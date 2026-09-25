// Plantillas de mensajes y helper para abrir WhatsApp.
// Los textos viven aquí para que Lynn pueda cambiarlos en un solo lugar.

import { hora, fechaLarga } from '../formato'

export type PlantillaKey = 'confirmacion' | 'recordatorio' | 'retraso' | 'gracias'

export type DatosMensaje = {
  cliente_nombre: string
  starts_at: string           // ISO
  servicios: string           // "Polygel + Retirada"
  total_amount: number
  currency: string
  code: string                // "NBL-XXXX"
  access_token: string        // para armar enlace /cita/{token}
}

// Base pública del sitio (se usa para armar el link de la cita)
function urlPublica(): string {
  const origen = window.location.origin
  const base = import.meta.env.BASE_URL || '/'
  return `${origen}${base}`
}

function primeroNombre(nombre: string) {
  return nombre.trim().split(/\s+/)[0]
}

export function armarMensaje(clave: PlantillaKey, d: DatosMensaje): string {
  const nombre = primeroNombre(d.cliente_nombre)
  const cuando = `${fechaLarga(d.starts_at)} a las ${hora(d.starts_at)}`
  const link = `${urlPublica()}cita/${d.access_token}`
  const codigo = d.code

  switch (clave) {
    case 'confirmacion':
      return (
`Hola ${nombre} ✨

Tu cita en Nails by Lynn está confirmada:

📅 ${cuando}
💅 ${d.servicios}
🔖 Código: ${codigo}

Puedes ver o cancelar tu cita aquí:
${link}

¡Te espero!`)

    case 'recordatorio':
      return (
`Hola ${nombre} 💖

Te recuerdo tu cita mañana:

📅 ${cuando}
💅 ${d.servicios}

Si necesitas reprogramar, escríbeme antes por aquí para poder liberar el hueco.

¡Nos vemos!`)

    case 'retraso':
      return (
`Hola ${nombre} 🙏

Estoy con un pequeño retraso hoy. Tu cita seguirá adelante, pero podría empezar unos minutos más tarde de lo previsto.

Gracias por tu paciencia 💗`)

    case 'gracias':
      return (
`¡Muchas gracias por tu visita, ${nombre}! 💅✨

Espero que hayan quedado como querías. Si te gusta el resultado, me alegraría mucho una foto en tu Instagram etiquetando a Nails by Lynn.

Para tu próxima cita:
${urlPublica()}reservar

¡Un beso!`)
  }
}

// Devuelve el URL wa.me con el mensaje ya codificado
// Número listo para wa.me: solo dígitos y con prefijo 53 si es un móvil cubano de 8 dígitos
export function numeroWhatsApp(telefono: string): string {
  const soloDigitos = telefono.replace(/\D/g, '')
  return soloDigitos.length === 8 ? '53' + soloDigitos : soloDigitos
}

export function enlaceWhatsApp(telefono: string, mensaje: string): string {
  const texto = encodeURIComponent(mensaje)
  return `https://wa.me/${numeroWhatsApp(telefono)}?text=${texto}`
}

// Etiquetas humanas para los botones
export const ETIQUETAS: Record<PlantillaKey, { titulo: string; icono: string; descripcion: string }> = {
  confirmacion: { titulo: 'Enviar confirmación', icono: '✅', descripcion: 'Al reservar por primera vez' },
  recordatorio: { titulo: 'Enviar recordatorio', icono: '🔔', descripcion: '24h antes de la cita' },
  retraso:      { titulo: 'Avisar de retraso',   icono: '⏰', descripcion: 'Si vas con demora hoy' },
  gracias:      { titulo: 'Enviar agradecimiento', icono: '💖', descripcion: 'Después de completar' },
}
