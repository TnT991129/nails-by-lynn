// Traduce los codigos que lanzan las funciones de PostgreSQL a lenguaje de marca.
const MENSAJES: Record<string, string> = {
  RETENCION_VENCIDA:     'Se agotó el tiempo para completar tu reserva. Elige tu hora de nuevo 💗',
  HORARIO_YA_TOMADO:     '¡Justo tomaron esa hora! Te mostramos las que siguen disponibles.',
  HORARIO_NO_DISPONIBLE: 'Esa hora ya no está libre. Elige otra, por favor.',
  DEMASIADO_PRONTO:      'Esa hora está muy cerca. Elige un horario con más antelación.',
  DEMASIADO_LEJOS:       'Todavía no abrimos la agenda para esa fecha.',
  TELEFONO_INVALIDO:     'Revisa el número, parece incompleto.',
  LIMITE_CITAS_ACTIVAS:  'Ya tienes tus citas reservadas. Cancela una o escríbeme por WhatsApp.',
  LIMITE_DISPOSITIVO:    'Hiciste muchas reservas hoy. Inténtalo mañana o escríbeme por WhatsApp.',
  CLIENTA_BLOQUEADA:     'No pudimos completar la reserva. Escríbeme por WhatsApp, por favor.',
  RESERVAS_CERRADAS:     'Ahora mismo no estamos tomando reservas.',
  SERVICIO_NO_DISPONIBLE:'Ese servicio ya no está disponible.',
  ADDON_NO_DISPONIBLE:   'Uno de los extras ya no está disponible.',
  SIN_SERVICIOS:         'Elige al menos un servicio.',
  CITA_NO_ENCONTRADA:    'No encontramos esa cita.',
  CITA_NO_CANCELABLE:    'Esta cita ya no se puede cancelar.',
  CITA_NO_REPROGRAMABLE: 'Esta cita ya no se puede cambiar.',
  FUERA_DE_PLAZO:        'Ya pasó el plazo para hacer este cambio. Escríbeme por WhatsApp 💗',
  LIMITE_REPROGRAMACIONES:'Ya cambiaste esta cita el máximo de veces permitido.',
  HORARIO_OCUPADO:       'Ese horario choca con otra cita. Elige otro.',
  TELEFONO_DUPLICADO:    'Ya hay una clienta con ese teléfono.',
  CLIENTA_CON_CITAS:     'Esta clienta tiene citas en su historial y no se puede eliminar. Puedes bloquearla.',
}

export function mensajeDeError(e: unknown): string {
  const raw = (e as { message?: string })?.message ?? ''
  for (const clave of Object.keys(MENSAJES)) {
    if (raw.includes(clave)) return MENSAJES[clave]
  }
  if (raw.toLowerCase().includes('fetch') || raw.toLowerCase().includes('network')) {
    return 'Parece que no hay conexión. Revisa tus datos o el wifi.'
  }
  return 'Algo salió mal de nuestro lado. Inténtalo otra vez.'
}

export function codigoDeError(e: unknown): string | null {
  const raw = (e as { message?: string })?.message ?? ''
  const m = raw.match(/[A-Z_]{5,}/)
  return m ? m[0] : null
}
