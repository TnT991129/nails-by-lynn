export const ZONA = 'America/Havana'

const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio',
               'agosto','septiembre','octubre','noviembre','diciembre']

function partes(iso: string) {
  const f = new Intl.DateTimeFormat('es-CU', {
    timeZone: ZONA, weekday:'long', day:'numeric', month:'numeric',
    hour:'numeric', minute:'2-digit', hour12:true,
  }).formatToParts(new Date(iso))
  const g = (t: string) => f.find(p => p.type === t)?.value ?? ''
  return g
}

export function fechaLarga(iso: string): string {
  const d = new Date(iso)
  const dia = Number(new Intl.DateTimeFormat('en',{timeZone:ZONA,day:'numeric'}).format(d))
  const mes = Number(new Intl.DateTimeFormat('en',{timeZone:ZONA,month:'numeric'}).format(d)) - 1
  const sem = new Intl.DateTimeFormat('en',{timeZone:ZONA,weekday:'short'}).format(d)
  const idx = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(sem)
  const nombre = DIAS[idx < 0 ? 0 : idx]
  return `${nombre} ${dia} de ${MESES[mes]}`
}

export function hora(iso: string): string {
  const g = partes(iso)
  return `${g('hour')}:${g('minute')} ${g('dayPeriod').toUpperCase().replace(/\./g,'')}`
}

export function franja(iso: string): 'Mañana' | 'Tarde' | 'Noche' {
  const h = Number(new Intl.DateTimeFormat('en',{timeZone:ZONA,hour:'numeric',hour12:false}).format(new Date(iso)))
  if (h < 12) return 'Mañana'
  if (h < 18) return 'Tarde'
  return 'Noche'
}

export function duracion(min: number): string {
  const h = Math.floor(min / 60), m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return h === 1 ? '1 hora' : `${h} horas`
  return `${h} h ${m} min`
}

export function dinero(monto: number, moneda = 'CUP'): string {
  if (!monto || monto === 0) return 'Por definir'
  const n = new Intl.NumberFormat('es-CU', { maximumFractionDigits: 2 }).format(monto)
  return moneda === 'USD' ? `$${n}` : `${n} CUP`
}

export function fechaISO(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(d)
}

/** "2026-10-02" + "15:30" en hora de La Habana → ISO en UTC */
export function instanteEnHabana(fecha: string, hhmm: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  const supuesto = Date.UTC(y, m - 1, d, h, mi)
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA, hourCycle: 'h23', year: 'numeric', month: 'numeric',
    day: 'numeric', hour: 'numeric', minute: 'numeric',
  }).formatToParts(new Date(supuesto))
  const g = (t: string) => Number(p.find(x => x.type === t)?.value)
  const pared = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'))
  return new Date(supuesto - (pared - supuesto)).toISOString()
}

export function cuentaAtras(hasta: string): string {
  const s = Math.max(0, Math.floor((new Date(hasta).getTime() - Date.now()) / 1000))
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
}
