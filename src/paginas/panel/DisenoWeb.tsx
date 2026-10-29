import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerTextosPanel, guardarDiseno, obtenerLogo, cambiarLogo, registrarErrorSubida } from '../../lib/panel/api-panel'
import {
  leerDisenoDeTextos, normalizar, DISENO_INICIAL, COLOR_ORIGINAL, NOMBRES_SECCIONES, FUENTES_TITULOS, FUENTES_TEXTO,
  CLAVE_BORRADOR, paleta, type Diseno,
} from '../../lib/diseno'
import { Boton, Tarjeta, Aviso, Esqueleto } from '../../componentes/ui'
import { IconoAtras, IconoCerrar } from '../../componentes/iconos'
import { mensajeDeError, mensajeDeErrorSubida } from '../../lib/errores'
import { Volver } from './comunes'

// Lynn personaliza la web de sus clientas: colores, letras, formas, fondo, portada, secciones y animaciones.
// Mientras edita, la vista previa (la web de verdad en un iframe) sigue el borrador por localStorage.

const COLORES: { nombre: string; hex: string }[] = [
  { nombre: 'Rosa Lynn', hex: COLOR_ORIGINAL }, { nombre: 'Fucsia', hex: '#c026d3' }, { nombre: 'Lila', hex: '#7c3aed' },
  { nombre: 'Cereza', hex: '#be123c' }, { nombre: 'Coral', hex: '#e8505b' }, { nombre: 'Nude', hex: '#a86f5c' },
  { nombre: 'Dorado', hex: '#a87612' }, { nombre: 'Menta', hex: '#0f8f7e' }, { nombre: 'Azul noche', hex: '#2f4ba0' },
  { nombre: 'Negro elegante', hex: '#3a2431' },
]

export default function DisenoWeb() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['textos-panel'], queryFn: obtenerTextosPanel })
  const guardado = q.data ? leerDisenoDeTextos(q.data) : null
  const [d, setD] = useState<Diseno | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)
  const [previaMovil, setPreviaMovil] = useState(false)

  if (guardado && !d) setD(guardado)

  // La vista previa lee el borrador; al salir de esta página se borra
  useEffect(() => {
    if (!d) return
    try { localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(d)) } catch { /* sin almacenamiento: sin vista previa en vivo */ }
  }, [d])
  useEffect(() => () => { try { localStorage.removeItem(CLAVE_BORRADOR) } catch { /* nada */ } }, [])

  if (q.isLoading || !d) return <div className="p-5 space-y-3"><Esqueleto className="h-10 w-48" /><Esqueleto className="h-64" /></div>
  if (q.isError) return <div className="p-5"><Aviso>{mensajeDeError(q.error)}</Aviso></div>

  const cambios = JSON.stringify(d) !== JSON.stringify(guardado)
  const poner = (parcial: Partial<Diseno>) => { setD(normalizar({ ...d, ...parcial })); setHecho(false) }

  async function guardar() {
    if (!d) return
    setGuardando(true); setError(null); setHecho(false)
    try {
      await guardarDiseno(d)
      await qc.invalidateQueries({ queryKey: ['textos-panel'] })
      qc.invalidateQueries({ queryKey: ['textos'] })
      setHecho(true)
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  const BASE = import.meta.env.BASE_URL
  // La vista previa se recarga si cambian las animaciones (se deciden al abrir la página)
  const previa = (
    <iframe key={d.animaciones} title="Vista previa de la web" src={`${BASE}?vista_previa=1`}
            className="w-[390px] h-[780px] border-0 bg-superficie-base" />
  )

  return (
    <div className="p-5 pb-36 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8 lg:items-start">
      <div className="space-y-4 min-w-0">
        <Volver />
        <div>
          <h1 className="text-[30px] leading-tight">Diseño de la web</h1>
          <p className="text-[14px] text-tinta-tenue mt-1">
            Cambia cómo se ve tu web. Nada cambia para tus clientas hasta que pulses <b>Guardar</b>.
          </p>
        </div>

        <Bloque titulo="Color principal" ayuda="Botones, precios y detalles. Los tonos claros y oscuros salen solos.">
          <div className="grid grid-cols-5 gap-2.5">
            {COLORES.map(c => (
              <button key={c.hex} onClick={() => poner({ color: c.hex })} aria-pressed={d.color === c.hex} title={c.nombre}
                className={`aspect-square rounded-full transition duration-300 ring-offset-2 ring-offset-papel
                  ${d.color === c.hex ? 'ring-2 ring-tinta scale-110' : 'hover:scale-105'}`}
                style={{ background: `linear-gradient(135deg, rgb(${paleta(c.hex).clara['--rosa-400']}), ${c.hex})` }}>
                <span className="sr-only">{c.nombre}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3 mt-3 text-[14px]">
            <input type="color" value={d.color} onChange={e => poner({ color: e.target.value })}
                   className="w-11 h-11 rounded-full border border-rosa-200 cursor-pointer bg-transparent p-0.5" />
            <span>Otro color: <span className="font-mono text-tinta-tenue">{d.color}</span></span>
          </label>
        </Bloque>

        <Bloque titulo="Letra de los títulos">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(FUENTES_TITULOS) as Diseno['fuenteTitulos'][]).map(f => (
              <Opcion key={f} activa={d.fuenteTitulos === f} onClick={() => poner({ fuenteTitulos: f })}>
                <span className="block text-[22px] leading-tight" style={{ fontFamily: FUENTES_TITULOS[f].pila }}>Nails by Lynn</span>
                <span className="block text-[12px] text-tinta-tenue mt-1">{FUENTES_TITULOS[f].nombre}</span>
              </Opcion>
            ))}
          </div>
        </Bloque>

        <Bloque titulo="Letra de los textos">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(FUENTES_TEXTO) as Diseno['fuenteTexto'][]).map(f => (
              <Opcion key={f} activa={d.fuenteTexto === f} onClick={() => poner({ fuenteTexto: f })}>
                <span className="block text-[15px]" style={{ fontFamily: FUENTES_TEXTO[f].pila }}>Reserva tu cita</span>
                <span className="block text-[12px] text-tinta-tenue mt-1">{FUENTES_TEXTO[f].nombre}</span>
              </Opcion>
            ))}
          </div>
        </Bloque>

        <Bloque titulo="Formas">
          <div className="text-[13px] font-medium text-tinta-suave mb-2">Esquinas de las tarjetas</div>
          <div className="grid grid-cols-3 gap-2">
            {([['rectas', 'Rectas', 6], ['suaves', 'Suaves', 14], ['redondas', 'Muy redondas', 26]] as const).map(([v, nombre, r]) => (
              <Opcion key={v} activa={d.esquinas === v} onClick={() => poner({ esquinas: v })}>
                <span className="block h-10 border-2 border-rosa-300 bg-rosa-50" style={{ borderRadius: r }} />
                <span className="block text-[12px] text-tinta-tenue mt-1.5">{nombre}</span>
              </Opcion>
            ))}
          </div>
          <div className="text-[13px] font-medium text-tinta-suave mt-4 mb-2">Botones</div>
          <div className="grid grid-cols-2 gap-2">
            {([['pildora', 'Píldora', 999], ['redondeados', 'Redondeados', 14]] as const).map(([v, nombre, r]) => (
              <Opcion key={v} activa={d.botones === v} onClick={() => poner({ botones: v })}>
                <span className="block h-9 bg-rosa-600 text-white text-[13px] font-semibold leading-9" style={{ borderRadius: r }}>Reservar</span>
                <span className="block text-[12px] text-tinta-tenue mt-1.5">{nombre}</span>
              </Opcion>
            ))}
          </div>
        </Bloque>

        <Bloque titulo="Fondo">
          <div className="grid grid-cols-4 gap-2">
            {([['liso', 'Liso'], ['degradado', 'Degradado'], ['puntos', 'Puntitos'], ['brillos', 'Luces']] as const).map(([v, nombre]) => (
              <Opcion key={v} activa={d.fondo === v} onClick={() => poner({ fondo: v })}>
                <span className="block h-12 rounded-sm border border-rosa-100" style={{ background: muestraFondo(v) }} />
                <span className="block text-[12px] text-tinta-tenue mt-1.5">{nombre}</span>
              </Opcion>
            ))}
          </div>
        </Bloque>

        <Bloque titulo="Portada" ayuda="La parte de arriba de la web, con tu foto.">
          <div className="grid grid-cols-2 gap-2">
            {([['tarjeta', 'Tarjeta'], ['completa', 'Pantalla completa']] as const).map(([v, nombre]) => (
              <Opcion key={v} activa={d.portada === v} onClick={() => poner({ portada: v })}>
                <span className={`block h-20 bg-gradient-to-b from-rosa-200 to-rosa-600 ${v === 'tarjeta' ? 'mx-2 mt-2 rounded' : 'rounded-sm'}`} />
                <span className="block text-[12px] text-tinta-tenue mt-1.5">{nombre}</span>
              </Opcion>
            ))}
          </div>
          <label className="block mt-4">
            <span className="flex justify-between text-[13px] font-medium text-tinta-suave">
              <span>Oscurecer la foto bajo el texto</span><span className="tabular-nums">{d.oscurecer} %</span>
            </span>
            <input type="range" min={0} max={100} step={5} value={d.oscurecer}
                   onChange={e => poner({ oscurecer: Number(e.target.value) })} className="w-full accent-rosa-600 mt-2" />
          </label>
          <Interruptor activo={d.destellos} onChange={v => poner({ destellos: v })}
                       titulo="Destellos sobre la foto" desc="Estrellitas que titilan" />
          <div className="flex flex-wrap gap-2 mt-3">
            <Link to="/panel/portada" className="text-[14px] font-semibold text-rosa-800 underline min-h-[40px] inline-flex items-center">
              Cambiar la foto de portada
            </Link>
          </div>
          <LogoWeb />
        </Bloque>

        <Bloque titulo="Secciones del inicio" ayuda="Muestra u oculta cada parte, y cambia el orden con las flechas.">
          <ul className="divide-y divide-rosa-100 -mx-1">
            {d.secciones.map((s, i) => (
              <li key={s.id} className={`flex items-center gap-2 px-1 py-2.5 transition-opacity ${s.visible ? '' : 'opacity-55'}`}>
                <div className="flex flex-col">
                  <button aria-label="Subir" disabled={i === 0} onClick={() => poner({ secciones: mover(d.secciones, i, -1) })}
                          className="w-8 h-7 flex items-center justify-center text-tinta-suave disabled:opacity-25">
                    <IconoAtras tam={16} className="rotate-90" />
                  </button>
                  <button aria-label="Bajar" disabled={i === d.secciones.length - 1} onClick={() => poner({ secciones: mover(d.secciones, i, 1) })}
                          className="w-8 h-7 flex items-center justify-center text-tinta-suave disabled:opacity-25">
                    <IconoAtras tam={16} className="-rotate-90" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium">{NOMBRES_SECCIONES[s.id].titulo}</div>
                  <div className="text-[12px] text-tinta-tenue">{NOMBRES_SECCIONES[s.id].desc}</div>
                </div>
                <Llave activo={s.visible} etiqueta={`Mostrar ${NOMBRES_SECCIONES[s.id].titulo}`}
                       onChange={v => poner({ secciones: d.secciones.map(x => x.id === s.id ? { ...x, visible: v } : x) })} />
              </li>
            ))}
          </ul>
        </Bloque>

        <Bloque titulo="Animaciones">
          <div className="space-y-2">
            {([['completas', 'Completas', 'Todo con movimiento: brillos, cintas, luces…'],
               ['suaves', 'Suaves', 'Las secciones aparecen con suavidad, sin nada que se mueva solo'],
               ['ninguna', 'Sin animaciones', 'Todo quieto (más rápido en móviles antiguos)']] as const).map(([v, nombre, desc]) => (
              <Opcion key={v} activa={d.animaciones === v} onClick={() => poner({ animaciones: v })} izquierda>
                <span className="block text-[15px] font-medium">{nombre}</span>
                <span className="block text-[12px] text-tinta-tenue">{desc}</span>
              </Opcion>
            ))}
          </div>
        </Bloque>

        <Bloque titulo="Modo claro u oscuro" ayuda="Lo que ve quien no ha elegido uno con el botón de la luna.">
          <div className="grid grid-cols-3 gap-2">
            {([['auto', 'Como el móvil'], ['claro', 'Claro'], ['oscuro', 'Oscuro']] as const).map(([v, nombre]) => (
              <Opcion key={v} activa={d.tema === v} onClick={() => poner({ tema: v })}>
                <span className="block text-[14px] font-medium">{nombre}</span>
              </Opcion>
            ))}
          </div>
        </Bloque>

        <Bloque titulo="Textos">
          <p className="text-[14px] text-tinta-tenue">Todos los textos de la web (títulos, botones, avisos…) se cambian aparte.</p>
          <Link to="/panel/textos" className="inline-flex items-center min-h-[44px] text-[14px] font-semibold text-rosa-800 underline">
            Ir a Textos de la web
          </Link>
        </Bloque>

        <button onClick={() => { if (confirm('¿Volver al diseño original de la web?')) poner(DISENO_INICIAL) }}
                className="text-[14px] text-tinta-tenue underline min-h-[44px]">
          Volver al diseño original
        </button>
      </div>

      {/* Vista previa al lado (pantallas anchas) */}
      <div className="hidden lg:block sticky top-5">
        <div className="text-[13px] font-semibold text-tinta-suave mb-2 text-center">Vista previa en vivo</div>
        <Telefono>{previa}</Telefono>
      </div>

      {/* Barra de guardar */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] lg:bottom-0 z-30 px-4 pb-3 pointer-events-none">
        <div className="max-w-lg mx-auto bg-papel/95 backdrop-blur-lg border border-rosa-100 rounded-xl shadow-flota p-3
                        flex items-center gap-2 pointer-events-auto">
          <button onClick={() => setPreviaMovil(true)}
                  className="lg:hidden min-h-[48px] px-4 rounded-boton border border-rosa-200 text-rosa-800 font-semibold text-[14px]">
            Vista previa
          </button>
          {cambios && !guardando && (
            <button onClick={() => { setD(guardado); setHecho(false) }} className="min-h-[48px] px-3 text-[14px] text-tinta-tenue underline">
              Descartar
            </button>
          )}
          <Boton className="flex-1 !min-h-[48px]" cargando={guardando} disabled={!cambios} onClick={guardar}>
            {hecho && !cambios ? '✓ Guardado' : cambios ? 'Guardar' : 'Sin cambios'}
          </Boton>
        </div>
        {error && <div className="max-w-lg mx-auto mt-2 pointer-events-auto"><Aviso>{error}</Aviso></div>}
      </div>

      {/* Vista previa a pantalla completa (móvil) */}
      {previaMovil && (
        <div role="dialog" aria-modal="true" aria-label="Vista previa" className="fixed inset-0 z-50 bg-noche/95 flex flex-col animate-entrada">
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <span className="text-[14px]">Así la verán tus clientas{cambios ? ' (sin guardar)' : ''}</span>
            <button onClick={() => setPreviaMovil(false)} aria-label="Cerrar vista previa"
                    className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center"><IconoCerrar /></button>
          </div>
          <iframe key={d.animaciones} title="Vista previa de la web" src={`${BASE}?vista_previa=1`} className="flex-1 w-full border-0 bg-superficie-base rounded-t-xl" />
        </div>
      )}
    </div>
  )
}

function mover<T>(lista: T[], i: number, paso: -1 | 1): T[] {
  const nueva = [...lista]
  ;[nueva[i], nueva[i + paso]] = [nueva[i + paso], nueva[i]]
  return nueva
}

function muestraFondo(v: Diseno['fondo']): string {
  const base = 'rgb(var(--fondo))'
  if (v === 'liso') return base
  if (v === 'puntos') return `radial-gradient(rgb(var(--rosa-300) / .6) 1px, transparent 1.6px) 0 0 / 8px 8px, ${base}`
  if (v === 'brillos') return `radial-gradient(circle at 80% 10%, rgb(var(--rosa-200)), transparent 55%), radial-gradient(circle at 10% 90%, rgb(var(--rosa-100)), transparent 55%), ${base}`
  return `radial-gradient(circle at 100% 0%, rgb(var(--rosa-100)), transparent 65%), ${base}`
}

function Bloque({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <Tarjeta>
      <h2 className="font-sans text-[17px] font-semibold">{titulo}</h2>
      {ayuda && <p className="text-[13px] text-tinta-tenue mt-0.5">{ayuda}</p>}
      <div className="mt-3">{children}</div>
    </Tarjeta>
  )
}

function Opcion({ activa, onClick, children, izquierda = false }: { activa: boolean; onClick: () => void; children: ReactNode; izquierda?: boolean }) {
  return (
    <button onClick={onClick} aria-pressed={activa}
      className={`toque w-full rounded-lg border p-2.5 transition duration-200 active:scale-[0.97] ${izquierda ? 'text-left px-4 py-3' : 'text-center'}
        ${activa ? 'border-rosa-600 ring-4 ring-rosa-100 bg-rosa-50/60' : 'border-rosa-100 hover:border-rosa-300'}`}>
      {children}
    </button>
  )
}

function Llave({ activo, onChange, etiqueta }: { activo: boolean; onChange: (v: boolean) => void; etiqueta: string }) {
  return (
    <button role="switch" aria-checked={activo} aria-label={etiqueta} onClick={() => onChange(!activo)}
      className={`relative w-12 h-7 rounded-full transition-colors duration-300 shrink-0 ${activo ? 'bg-rosa-600' : 'bg-rosa-200'}`}>
      <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300
                        ease-[cubic-bezier(.34,1.56,.64,1)] ${activo ? 'translate-x-5' : ''}`} />
    </button>
  )
}

function Interruptor({ activo, onChange, titulo, desc }: { activo: boolean; onChange: (v: boolean) => void; titulo: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 mt-4">
      <div className="flex-1">
        <div className="text-[14px] font-medium">{titulo}</div>
        <div className="text-[12px] text-tinta-tenue">{desc}</div>
      </div>
      <Llave activo={activo} onChange={onChange} etiqueta={titulo} />
    </div>
  )
}

function Telefono({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-[300px] h-[600px] rounded-[44px] bg-noche p-3 shadow-lg ring-1 ring-black/10">
      <div className="relative w-full h-full overflow-hidden rounded-[34px] bg-superficie-base">
        {/* La web real a tamaño de móvil, reducida para que quepa */}
        <div className="origin-top-left scale-[0.71]" style={{ width: 390, height: 780 }}>{children}</div>
      </div>
    </div>
  )
}

// Logo de la web: el que viene con la web o uno que suba Lynn
function LogoWeb() {
  const qc = useQueryClient()
  const entrada = useRef<HTMLInputElement>(null)
  const q = useQuery({ queryKey: ['logo'], queryFn: obtenerLogo })
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const BASE = import.meta.env.BASE_URL

  async function cambiar(archivo: File | null) {
    if (!archivo && !confirm('¿Volver a poner el logo de siempre?')) return
    setTrabajando(true); setError(null)
    try {
      await cambiarLogo(archivo)
      qc.invalidateQueries({ queryKey: ['logo'] })
      qc.invalidateQueries({ queryKey: ['negocio'] })
    } catch (e) {
      setError(mensajeDeErrorSubida(e))
      if (archivo) registrarErrorSubida('logo', e, archivo)
    } finally {
      setTrabajando(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-rosa-100">
      <div className="text-[13px] font-medium text-tinta-suave mb-2">Logo (arriba de la portada)</div>
      <div className="flex items-center gap-3">
        <div className="w-28 h-14 rounded-lg bg-rosa-50 border border-rosa-100 flex items-center justify-center p-2">
          {q.isLoading ? <Esqueleto className="w-full h-full" /> : (
            <img src={q.data ?? `${BASE}logo-horizontal-rosa.png`} alt="Logo actual" crossOrigin={q.data ? 'anonymous' : undefined}
                 className="max-w-full max-h-full object-contain" />
          )}
        </div>
        <div className="flex-1 space-y-1.5">
          <input ref={entrada} type="file" accept="image/*" className="hidden"
                 onChange={e => e.target.files?.[0] && cambiar(e.target.files[0])} />
          <Boton variante="secundario" ancho cargando={trabajando} onClick={() => entrada.current?.click()} className="!min-h-[44px] !text-[14px]">
            Subir otro logo
          </Boton>
          {q.data && (
            <button onClick={() => cambiar(null)} disabled={trabajando} className="text-[13px] text-tinta-tenue underline">
              Volver al de siempre
            </button>
          )}
        </div>
      </div>
      <p className="text-[12px] text-tinta-tenue mt-2">Mejor un PNG con fondo transparente. Se ve en la web al momento.</p>
      {error && <div className="mt-2"><Aviso>{error}</Aviso></div>}
    </div>
  )
}
