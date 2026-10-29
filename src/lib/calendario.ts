// La clienta guarda su cita en el calendario del móvil: el propio móvil le recuerda la cita
// (el día antes y 2 horas antes) aunque no tenga conexión. Sin servidor: el archivo se crea aquí.

type CitaCalendario = {
  code: string; inicio: string; fin: string
  servicios: string[]; negocio: string; ubicacion?: string | null; enlace: string
}

/** 2026-11-02T14:00:00.000Z → 20261102T140000Z */
const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

// Texto de una línea de .ics: se escapan comas, punto y coma y saltos
const escapar = (t: string) => t.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n')

export function archivoIcs(c: CitaCalendario): string {
  const titulo = `💅 ${c.negocio}: ${c.servicios.join(' + ')}`
  const lineas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nails by Lynn//Reservas//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${c.code}@nailsbylynn`,
    `DTSTAMP:${utc(new Date().toISOString())}`,
    `DTSTART:${utc(c.inicio)}`,
    `DTEND:${utc(c.fin)}`,
    `SUMMARY:${escapar(titulo)}`,
    `DESCRIPTION:${escapar(`Tu cita ${c.code}. Para verla, cambiarla o cancelarla: ${c.enlace}`)}`,
    ...(c.ubicacion ? [`LOCATION:${escapar(c.ubicacion)}`] : []),
    `URL:${c.enlace}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapar(`Mañana tienes cita en ${c.negocio}`)}`, 'TRIGGER:-P1D', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapar(`En 2 horas tienes cita en ${c.negocio}`)}`, 'TRIGGER:-PT2H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ]
  // El estándar pide partir las líneas largas (las siguientes empiezan con un espacio); sin cortar emojis
  const partir = (l: string) => {
    const letras = Array.from(l)
    if (letras.length <= 70) return l
    const trozos: string[] = []
    for (let i = 0; i < letras.length; i += 70) trozos.push(letras.slice(i, i + 70).join(''))
    return trozos.join('\r\n ')
  }
  return lineas.map(partir).join('\r\n')
}

/** Descarga el .ics: el iPhone lo abre en Calendario y Android en su app de calendario */
export function descargarIcs(c: CitaCalendario) {
  const blob = new Blob([archivoIcs(c)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cita-${c.code}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Enlace para añadirla en Google Calendar (para quien use Gmail en Android) */
export function enlaceGoogleCalendar(c: CitaCalendario): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `💅 ${c.negocio}: ${c.servicios.join(' + ')}`,
    dates: `${utc(c.inicio)}/${utc(c.fin)}`,
    details: `Tu cita ${c.code}. Para verla, cambiarla o cancelarla: ${c.enlace}`,
    ...(c.ubicacion ? { location: c.ubicacion } : {}),
  })
  return `https://calendar.google.com/calendar/render?${p}`
}
