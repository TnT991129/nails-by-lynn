import { useEffect, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { obtenerTextosGuardados, leerTextosLocales } from './textos'

// Diseño de la web de las clientas. Lynn lo cambia en Panel → Más → Diseño de la web.
// Se guarda como JSON dentro de settings.site_texts (clave CLAVE_DISENO): así llega junto con los textos,
// sin peticiones nuevas ni cambios en la base de datos. index.html aplica el último visto antes de pintar.

export const CLAVE_DISENO = '_diseno'

export type SeccionInicio = 'datos' | 'cinta' | 'servicios' | 'galeria' | 'resenas' | 'pasos' | 'contacto'
export type Diseno = {
  color: string                                    // color principal (#rrggbb)
  fuenteTitulos: 'elegante' | 'moderna' | 'clasica' | 'manuscrita' | 'redonda'
  fuenteTexto: 'sistema' | 'redonda' | 'clasica'
  esquinas: 'rectas' | 'suaves' | 'redondas'
  botones: 'pildora' | 'redondeados'
  fondo: 'liso' | 'degradado' | 'puntos' | 'brillos'
  portada: 'tarjeta' | 'completa'
  oscurecer: number                                // 0–100: cuánto se oscurece la foto bajo el texto
  destellos: boolean
  animaciones: 'completas' | 'suaves' | 'ninguna'
  tema: 'auto' | 'claro' | 'oscuro'               // el que ve quien no ha elegido uno con el botón
  secciones: { id: SeccionInicio; visible: boolean }[]
}

export const COLOR_ORIGINAL = '#d6156f'

export const NOMBRES_SECCIONES: Record<SeccionInicio, { titulo: string; desc: string }> = {
  datos:     { titulo: 'Horario y lugar',   desc: 'Los dos recuadros bajo la portada' },
  cinta:     { titulo: 'Cinta de servicios', desc: 'Franja que se mueve con los nombres de tus servicios' },
  servicios: { titulo: 'Servicios',          desc: 'La lista con precios para reservar' },
  galeria:   { titulo: 'Galería destacada',  desc: 'Tus fotos favoritas en un collage' },
  resenas:   { titulo: 'Opiniones',          desc: 'Lo que dicen tus clientas' },
  pasos:     { titulo: 'Cómo reservar',      desc: 'Los tres pasos' },
  contacto:  { titulo: 'Contacto',           desc: 'El bloque oscuro con WhatsApp' },
}

export const DISENO_INICIAL: Diseno = {
  color: COLOR_ORIGINAL, fuenteTitulos: 'elegante', fuenteTexto: 'sistema', esquinas: 'suaves', botones: 'pildora',
  fondo: 'degradado', portada: 'tarjeta', oscurecer: 85, destellos: true, animaciones: 'completas', tema: 'auto',
  secciones: (['datos', 'cinta', 'servicios', 'galeria', 'resenas', 'pasos', 'contacto'] as SeccionInicio[])
    .map(id => ({ id, visible: true })),
}

export const FUENTES_TITULOS: Record<Diseno['fuenteTitulos'], { nombre: string; pila: string }> = {
  elegante:   { nombre: 'Elegante',   pila: '"Playfair Display", Didot, "Bodoni 72", Georgia, "Noto Serif", serif' },
  clasica:    { nombre: 'Clásica',    pila: 'Georgia, "Times New Roman", "Noto Serif", serif' },
  moderna:    { nombre: 'Moderna',    pila: '"Helvetica Neue", Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  redonda:    { nombre: 'Redondeada', pila: 'ui-rounded, "SF Pro Rounded", Nunito, "Varela Round", "Segoe UI", system-ui, sans-serif' },
  manuscrita: { nombre: 'Manuscrita', pila: '"Snell Roundhand", "Segoe Script", "Brush Script MT", "Dancing Script", cursive' },
}
export const FUENTES_TEXTO: Record<Diseno['fuenteTexto'], { nombre: string; pila: string }> = {
  sistema: { nombre: 'Limpia',     pila: 'Inter, system-ui, sans-serif' },
  redonda: { nombre: 'Redondeada', pila: 'ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif' },
  clasica: { nombre: 'Clásica',    pila: 'Georgia, "Noto Serif", serif' },
}
const RADIOS: Record<Diseno['esquinas'], [number, number, number, number]> = {
  rectas: [4, 6, 10, 12], suaves: [8, 12, 20, 28], redondas: [12, 18, 28, 36],
}

/** Lo guardado (que puede venir incompleto o de una versión anterior) completado con lo de siempre */
export function normalizar(crudo: unknown): Diseno {
  const d = (crudo && typeof crudo === 'object' ? crudo : {}) as Partial<Diseno>
  const de = <K extends keyof Diseno>(k: K, validos?: readonly unknown[]): Diseno[K] =>
    d[k] !== undefined && (!validos || validos.includes(d[k])) ? d[k] as Diseno[K] : DISENO_INICIAL[k]
  const vistas = new Set<SeccionInicio>()
  const secciones = (Array.isArray(d.secciones) ? d.secciones : [])
    .filter(s => s && s.id in NOMBRES_SECCIONES && !vistas.has(s.id) && vistas.add(s.id))
    .map(s => ({ id: s.id, visible: s.visible !== false }))
  // Secciones nuevas que aún no estaban guardadas: al final, visibles
  for (const s of DISENO_INICIAL.secciones) if (!vistas.has(s.id)) secciones.push({ ...s })
  return {
    color: /^#[0-9a-f]{6}$/i.test(d.color ?? '') ? d.color!.toLowerCase() : COLOR_ORIGINAL,
    fuenteTitulos: de('fuenteTitulos', Object.keys(FUENTES_TITULOS)),
    fuenteTexto: de('fuenteTexto', Object.keys(FUENTES_TEXTO)),
    esquinas: de('esquinas', Object.keys(RADIOS)),
    botones: de('botones', ['pildora', 'redondeados']),
    fondo: de('fondo', ['liso', 'degradado', 'puntos', 'brillos']),
    portada: de('portada', ['tarjeta', 'completa']),
    oscurecer: Math.min(100, Math.max(0, Number(d.oscurecer ?? DISENO_INICIAL.oscurecer) || 0)),
    destellos: d.destellos !== false,
    animaciones: de('animaciones', ['completas', 'suaves', 'ninguna']),
    tema: de('tema', ['auto', 'claro', 'oscuro']),
    secciones,
  }
}

export function leerDisenoDeTextos(textos: Record<string, string> | undefined | null): Diseno {
  try { return normalizar(JSON.parse(textos?.[CLAVE_DISENO] ?? '{}')) } catch { return normalizar({}) }
}

// ---------- Paleta a partir de un color ----------
type HSL = [number, number, number]
function hexAHsl(hex: string): HSL {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s * 100, l * 100]
}
function hslARgb([h, s, l]: HSL): string {
  s /= 100; l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))))
  return `${f(0)} ${f(8)} ${f(4)}`
}
const PASOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const

/** Variables CSS del color: claro, oscuro y los tonos fijos (vino, acento claro) */
export function paleta(hex: string) {
  const [h, s0, l0] = hexAHsl(hex)
  const s = Math.min(s0, 92)
  const l600 = Math.min(Math.max(l0, 30), 50)   // el texto blanco tiene que leerse sobre el color principal
  const claro: number[] = [97, 95, 90, 81, 69, 60, l600, l600 - 5, l600 - 10, l600 - 20]
  const tonoClaro = (i: number) => hslARgb([h, i < 6 ? Math.min(s, i < 3 ? s * 0.95 : s) : s, claro[i]])
  const clara = Object.fromEntries(PASOS.map((p, i) => [`--rosa-${p}`, tonoClaro(i)]))
  const oscuraL = [12, 16, 23, 30, null, null, null, 80, 85, 90]
  const oscura = Object.fromEntries(PASOS.map((p, i) => [`--rosa-${p}`,
    oscuraL[i] === null ? tonoClaro(i) : hslARgb([h, i < 4 ? s * 0.45 : s * 0.9, oscuraL[i]!])]))
  return {
    clara, oscura,
    vino: hslARgb([h, s, Math.max(l600 - 12, 16)]),
    acento: tonoClaro(3),
    fondoClaro: hslARgb([h, Math.min(s, 40), 98]),
    fondoOscuro: hslARgb([h, Math.min(s, 35), 6]),
    noche: hslARgb([h, Math.min(s, 30), 12]),
    nocheOscura: hslARgb([h, Math.min(s, 30), 18]),
    temaColor: `rgb(${tonoClaro(5).replace(/ /g, ',')})`,
  }
}

/** Hoja de estilos del diseño (vacía si todo es como siempre) */
export function cssDelDiseno(d: Diseno): string {
  const reglas: string[] = []
  const raiz: string[] = []
  if (d.color !== COLOR_ORIGINAL) {
    const p = paleta(d.color)
    const vars = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k}:${v}`).join(';')
    raiz.push(vars(p.clara), `--vino:${p.vino}`, `--acento-claro:${p.acento}`, `--fondo:${p.fondoClaro}`, `--noche:${p.noche}`)
    reglas.push(`:root:root.oscuro{${vars(p.oscura)};--vino:${p.vino};--acento-claro:${p.acento};--fondo:${p.fondoOscuro};--noche:${p.nocheOscura}}`)
  }
  const [r1, r2, r3, r4] = RADIOS[d.esquinas]
  if (d.esquinas !== 'suaves') raiz.push(`--radio-sm:${r1}px;--radio:${r2}px;--radio-lg:${r3}px;--radio-xl:${r4}px`)
  if (d.botones === 'redondeados') raiz.push(`--radio-boton:${r3}px`)
  if (d.fuenteTitulos !== 'elegante') raiz.push(`--fuente-titulos:${FUENTES_TITULOS[d.fuenteTitulos].pila}`)
  if (d.fuenteTexto !== 'sistema') raiz.push(`--fuente-texto:${FUENTES_TEXTO[d.fuenteTexto].pila}`)
  // :root:root gana a index.css aunque esta hoja cargue antes (va en <head> desde index.html)
  if (raiz.length) reglas.unshift(`:root:root{${raiz.join(';')}}`)
  return reglas.join('\n')
}

const CLAVE_CSS = 'nbl.diseno.css'
const CLAVE_ATRIBUTOS = 'nbl.diseno.attrs'

/** Pone el diseño en la página. guardar = recordarlo para que index.html lo pinte al instante la próxima vez */
export function aplicarDiseno(d: Diseno, guardar = true) {
  const css = cssDelDiseno(d)
  let estilo = document.getElementById('nbl-diseno') as HTMLStyleElement | null
  if (!estilo) {
    estilo = document.createElement('style')
    estilo.id = 'nbl-diseno'
    document.head.appendChild(estilo)
  }
  if (estilo.textContent !== css) estilo.textContent = css
  const raiz = document.documentElement
  raiz.dataset.fondo = d.fondo
  raiz.dataset.animaciones = d.animaciones
  raiz.dataset.temaDiseno = d.tema
  // Tema de quien no ha elegido uno con el botón de la web: el que puso Lynn (o el del móvil)
  let elegido: string | null = null
  try { elegido = localStorage.getItem('nbl.tema') } catch { /* sin almacenamiento */ }
  if (!elegido) raiz.classList.toggle('oscuro',
    d.tema === 'oscuro' || (d.tema === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches))
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta && !location.pathname.includes('/panel')) {
    meta.setAttribute('content', d.color === COLOR_ORIGINAL ? '#EE4397' : paleta(d.color).temaColor)
  }
  if (guardar) {
    try {
      localStorage.setItem(CLAVE_CSS, css)
      localStorage.setItem(CLAVE_ATRIBUTOS, JSON.stringify({ fondo: d.fondo, animaciones: d.animaciones, tema: d.tema }))
    } catch { /* modo privado */ }
  }
}

// ---------- Vista previa (el panel la muestra en un iframe de la propia web) ----------
export const CLAVE_BORRADOR = 'nbl.diseno.borrador'
export const enVistaPrevia = typeof location !== 'undefined' && new URLSearchParams(location.search).has('vista_previa')

function leerBorrador(): Diseno | null {
  try { const v = localStorage.getItem(CLAVE_BORRADOR); return v ? normalizar(JSON.parse(v)) : null } catch { return null }
}

// Estado compartido: lo que se está mostrando ahora (lo guardado, o el borrador en la vista previa)
let actual: Diseno = (enVistaPrevia && leerBorrador()) || leerDisenoDeTextos(leerTextosLocales())
const oyentes = new Set<() => void>()
function fijar(d: Diseno) {
  if (JSON.stringify(d) === JSON.stringify(actual)) return
  actual = d
  oyentes.forEach(o => o())
}
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o) } }

/** El diseño que se ve ahora (para elegir secciones, estilo de portada…) */
export function useDiseno(): Diseno {
  return useSyncExternalStore(suscribir, () => actual)
}

/** Va una vez en la raíz de la app: trae el diseño guardado y lo aplica; en vista previa sigue al borrador */
export function useAplicarDiseno() {
  const q = useQuery({ queryKey: ['textos'], queryFn: obtenerTextosGuardados, staleTime: 10 * 60_000, placeholderData: leerTextosLocales })
  const guardado = q.data
  useEffect(() => {
    if (enVistaPrevia) return
    const d = leerDisenoDeTextos(guardado)
    fijar(d)
    aplicarDiseno(d)
  }, [guardado])

  useEffect(() => {
    if (!enVistaPrevia) return
    const seguir = () => { const b = leerBorrador(); if (b) { fijar(b); aplicarDiseno(b, false) } }
    seguir()
    const alCambiar = (e: StorageEvent) => { if (e.key === CLAVE_BORRADOR) seguir() }
    window.addEventListener('storage', alCambiar)
    return () => window.removeEventListener('storage', alCambiar)
  }, [])
}
