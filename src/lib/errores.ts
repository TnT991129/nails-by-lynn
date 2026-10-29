// Traduce los codigos que lanzan las funciones de PostgreSQL a lenguaje de marca.
const MENSAJES: Record<string, string> = {
  RETENCION_VENCIDA:     'Se agotó el tiempo para completar tu reserva. Elige tu hora de nuevo 💗',
  HORARIO_YA_TOMADO:     '¡Justo tomaron esa hora! Te mostramos las que siguen disponibles.',
  HORARIO_NO_DISPONIBLE: 'Esa hora ya no está libre. Elige otra, por favor.',
  DEMASIADAS_RETENCIONES:'Tienes varios turnos apartados a la vez. Espera unos minutos y vuelve a intentarlo.',
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
  LIMITE_LISTA_ESPERA:   'Ya estás en espera para 3 días. Espera a que te avisemos de alguno.',
  FECHA_NO_VALIDA:       'Esa fecha no está disponible.',
  NOMBRE_INVALIDO:       'Escribe tu nombre.',
  extra_price_max:       'Falta ejecutar en Supabase el SQL de rangos de precio (rango_complementos.sql).',
  addons_rango_valido:   'El precio «hasta» no puede ser menor que el precio «desde».',
  aplicar_descuento_cita: 'Falta ejecutar en Supabase el SQL complementos_y_descuentos.sql.',
  DESCUENTO_INVALIDO:    'El descuento tiene que estar entre 0 y 100 %.',
  RESENA_NO_DISPONIBLE:  'Podrás valorar tu cita cuando Lynn la marque como completada.',
  RESENA_INVALIDA:       'Elige de 1 a 5 estrellas.',
  RESENA_YA_PUBLICADA:   'Tu valoración ya está publicada. ¡Gracias!',
  dejar_resena:          'Las valoraciones aún no están activadas.',
  allergies:             'Falta ejecutar en Supabase el SQL de mejoras (mejoras.sql).',
  birthday:              'Falta ejecutar en Supabase el SQL de mejoras (mejoras.sql).',
  pa_verificacion:       'No se pudo guardar el cobro. Sal del panel y vuelve a entrar.',
  pa_monto:              'El monto no puede ser negativo.',
  CITA_NO_EDITABLE:      'Esta cita ya no se puede cambiar.',
  EDICION_FUERA_DE_PLAZO: 'Ya es muy tarde para cambiar los servicios desde aquí. Escríbele a Lynn por WhatsApp.',
  NO_CABE_EN_EL_TURNO:   'Con esos servicios la cita dura más y choca con la siguiente. Quita algo o cambia la fecha.',
  editar_cita:           'Cambiar servicios aún no está activado. Escríbele a Lynn por WhatsApp.',
  editar_cita_panel:     'Falta ejecutar en Supabase el SQL panel_editar_y_politicas.sql.',
  policy_sections:       'Falta ejecutar en Supabase el SQL panel_editar_y_politicas.sql.',
  site_texts:            'Falta ejecutar en Supabase el SQL textos_web.sql.',
  next_discount:         'Falta ejecutar en Supabase el SQL de descuentos (turnos_descuentos_cambios.sql).',
  loyalty_:              'Falta ejecutar en Supabase el SQL de la tarjeta de fidelidad (fidelidad_niveles.sql).',
  LIMITE_REPROGRAMACIONES_MES:'Ya cambiaste una cita este mes. Si necesitas moverla, escríbeme por WhatsApp.',
  HORARIO_OCUPADO:       'Ese horario choca con otra cita. Elige otro.',
  sin_citas_solapadas:   'Ese horario choca con otra cita. Elige otro.',
  settings_ventanas:     'El plazo mínimo para cancelar no puede ser mayor que el de cancelación gratis (24 horas).',
  TELEFONO_DUPLICADO:    'Ya hay una clienta con ese teléfono.',
  CLIENTA_CON_CITAS_ACTIVAS:'Tiene citas pendientes. Cancélalas primero para poder eliminarla.',
  CLIENTA_NO_ENCONTRADA: 'No encontramos esa clienta.',
  NO_AUTORIZADA:         'Tu sesión no tiene permiso para esto. Vuelve a entrar al panel.',
  PERMISO_DENEGADO:      'No diste permiso para los avisos. Puedes permitirlos en los ajustes del navegador o del móvil.',
  SUSCRIPCION_INVALIDA:  'Este móvil no pudo activar los avisos. Prueba desde otro navegador.',
  guardar_aviso_movil:   'Falta ejecutar en Supabase el SQL avisos_lynn.sql.',
  mis_avisos_movil:      'Falta ejecutar en Supabase el SQL avisos_lynn.sql.',
  gp_consentimiento:     'Para publicar esta foto, la clienta tiene que haber dado permiso.',
  IMAGEN_INVALIDA:       'No se pudo abrir esa foto. Prueba con otra, o haz una captura de pantalla de la foto y sube la captura.',
  SUBIDA_LENTA:          'La conexión está muy lenta y la foto no terminó de subir. Prueba con wifi o en otro momento.',
  SUBIDA_SIN_PERMISO:    'Supabase no deja subir fotos con esta cuenta. Sal del panel, vuelve a entrar y prueba otra vez.',
  FOTO_DEMASIADO_GRANDE: 'La foto pesa demasiado. Prueba con otra o haz una captura de pantalla de ella.',
  TIPO_NO_ADMITIDO:      'Ese tipo de archivo no se admite. Sube una foto JPG, PNG o WebP.',
  SIN_CONEXION_FOTO:     'No hay conexión suficiente para subir la foto. Revisa los datos o el wifi y vuelve a intentarlo.',
  SUBIDA_FALLIDA:        'La foto no se pudo subir.',
  FALTA_BUCKET:          'Falta el espacio de fotos «galeria» en Supabase (Storage).',
}

/** Mensaje de un fallo al subir una foto: el claro para Lynn y, debajo, en qué paso falló y por qué */
export function mensajeDeErrorSubida(e: unknown): string {
  const { paso, detalle } = (e ?? {}) as { paso?: string; detalle?: string }
  if (!paso) return mensajeDeErrorConDetalle(e)
  return `${mensajeDeError(e)} (Falló al ${paso}${detalle ? `: ${detalle}` : ''})`
}

/** Igual que mensajeDeError, pero si el error es desconocido añade el detalle técnico (para el panel) */
export function mensajeDeErrorConDetalle(e: unknown): string {
  const mensaje = mensajeDeError(e)
  const raw = (e as { message?: string })?.message ?? ''
  return mensaje === 'Algo salió mal de nuestro lado. Inténtalo otra vez.' && raw ? `${mensaje} (Detalle: ${raw})` : mensaje
}

export function mensajeDeError(e: unknown): string {
  const raw = (e as { message?: string })?.message ?? ''
  const clave = Object.keys(MENSAJES)
    .filter(k => raw.includes(k))
    .sort((a, b) => b.length - a.length)[0]   // la más específica
  if (clave) return MENSAJES[clave]
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
