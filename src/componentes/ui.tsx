import type { CSSProperties, ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from 'react'
import { Revelar, Subrayado } from './Movimiento'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro'

const ESTILOS: Record<Variante, string> = {
  primario:   'bg-gradient-to-br from-rosa-600 to-vino text-white hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg active:brightness-95 shadow-boton',
  secundario: 'bg-papel text-rosa-800 border border-rosa-200 hover:bg-rosa-50 hover:border-rosa-300',
  fantasma:   'bg-transparent text-tinta-suave hover:bg-rosa-50',
  peligro:    'bg-papel text-estado-error border border-estado-error/60 hover:bg-estado-error-fondo',
}

/** Clases de botón, para usarlas también en <Link> y <a> sin anidar un <button> dentro */
export function estiloBoton(variante: Variante = 'primario', ancho = false) {
  return [
    'toque min-h-[52px] px-6 rounded-boton font-semibold text-[16px] tracking-[0.01em]',
    'transition duration-200 ease-out active:scale-[0.97] active:translate-y-0',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
    'disabled:hover:translate-y-0 disabled:hover:brightness-100 disabled:hover:shadow-none',
    'inline-flex items-center justify-center gap-2',
    ESTILOS[variante], ancho ? 'w-full' : '',
  ].join(' ')
}

export function Boton({
  variante = 'primario', ancho, cargando, children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante; ancho?: boolean; cargando?: boolean
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || cargando}
      className={`${estiloBoton(variante, ancho)} ${props.className ?? ''}`}
    >
      {cargando && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-papel rounded-xl border border-rosa-100/80 shadow-suave p-5 ${className}`}>
      {children}
    </div>
  )
}

export function Etiqueta({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-rosa-700">
      {children}
    </span>
  )
}

const PILDORAS: Record<string, string> = {
  CONFIRMADA:        'bg-estado-exito-fondo text-estado-exito',
  PENDIENTE:         'bg-estado-aviso-fondo text-estado-aviso',
  COMPLETADA:        'bg-rosa-50 text-rosa-800',
  EN_CURSO:          'bg-rosa-100 text-rosa-800',
  CANCELADA_CLIENTA: 'bg-superficie-base text-tinta-tenue',
  CANCELADA_NEGOCIO: 'bg-superficie-base text-tinta-tenue',
  NO_SHOW:           'bg-estado-error-fondo text-estado-error',
}

const NOMBRES: Record<string, string> = {
  CONFIRMADA:'Confirmada', PENDIENTE:'Pendiente', COMPLETADA:'Completada',
  EN_CURSO:'En curso', CANCELADA_CLIENTA:'Cancelada',
  CANCELADA_NEGOCIO:'Cancelada', NO_SHOW:'No asististe',
}

export function Pildora({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full
                      ${PILDORAS[estado] ?? PILDORAS.PENDIENTE}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
      {NOMBRES[estado] ?? estado}
    </span>
  )
}

export function Campo({
  etiqueta, ayuda, error, ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: string; error?: string }) {
  return (
    <label className="block">
      <span className="block text-[14px] font-medium text-tinta-suave mb-1.5">{etiqueta}</span>
      <input
        {...props}
        aria-invalid={!!error}
        className={`w-full min-h-[52px] px-4 rounded-lg border text-[16px] bg-papel transition
          focus:outline-none focus:ring-4 focus:ring-rosa-100 focus:border-rosa-500
          ${error ? 'border-estado-error' : 'border-rosa-200'}
          placeholder:text-tinta-tenue/60`}
      />
      {error
        ? <span className="block text-[14px] text-estado-error mt-1.5">{error}</span>
        : ayuda && <span className="block text-[13px] text-tinta-tenue mt-1.5">{ayuda}</span>}
    </label>
  )
}

export function Esqueleto({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`reflejo rounded-lg ${className}`} style={style} />
}

export function Vacio({
  titulo, texto, children,
}: { titulo: string; texto: string; children?: ReactNode }) {
  return (
    <div className="text-center py-12 px-6 animate-entrada">
      <IlustracionEsmalte className="mx-auto mb-4" />
      <h3 className="font-display text-[22px] mb-2">{titulo}</h3>
      <p className="text-tinta-tenue mb-6 max-w-xs mx-auto text-[15px]">{texto}</p>
      {children}
    </div>
  )
}

export function Aviso({ tipo = 'error', children }: { tipo?: 'error' | 'aviso'; children: ReactNode }) {
  const c = tipo === 'error'
    ? 'bg-estado-error-fondo text-estado-error border-estado-error/20'
    : 'bg-estado-aviso-fondo text-estado-aviso border-estado-aviso/20'
  return <div role="alert" className={`rounded-lg border p-4 text-[14px] animate-entrada ${c}`}>{children}</div>
}

/** Frasco de esmalte con una gota que cae y destellos (estados vacíos) */
export function IlustracionEsmalte({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 110" width={96} height={110} aria-hidden className={`animate-flotar ${className}`}>
      <defs>
        <linearGradient id="esmalte-cuerpo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(var(--rosa-400))" /><stop offset="1" stopColor="rgb(var(--vino))" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="104" rx="26" ry="4" fill="rgb(var(--rosa-200) / .7)" />
      <rect x="38" y="6" width="20" height="30" rx="5" fill="rgb(var(--noche))" />
      <rect x="42" y="10" width="4" height="22" rx="2" fill="#fff" opacity=".18" />
      <rect x="22" y="34" width="52" height="64" rx="16" fill="url(#esmalte-cuerpo)" />
      <rect x="30" y="44" width="8" height="38" rx="4" fill="#fff" opacity=".35" />
      <circle className="esmalte-gota" cx="84" cy="62" r="4" fill="rgb(var(--rosa-500))" />
      <path className="animate-centelleo" d="M14 20l2.2 5 5 2.2-5 2.2-2.2 5-2.2-5-5-2.2 5-2.2z" fill="rgb(var(--rosa-400))" />
      <path className="animate-centelleo" style={{ animationDelay: '1.1s' }} d="M80 12l1.6 3.6 3.6 1.6-3.6 1.6L80 22.4l-1.6-3.6-3.6-1.6 3.6-1.6z" fill="rgb(var(--rosa-300))" />
    </svg>
  )
}

/** Etiqueta + título de sección con un trazo a mano que se dibuja al aparecer */
export function TituloSeccion({ etiqueta, titulo, extra, className = '' }: {
  etiqueta: string; titulo?: string; extra?: ReactNode; className?: string
}) {
  return (
    <Revelar className={className}>
      <Etiqueta>{etiqueta}</Etiqueta>
      <div className="flex items-end justify-between gap-3 mt-1.5">
        {titulo ? <h2 className="text-[30px] leading-[1.1]">{titulo}</h2> : <span />}
        {extra}
      </div>
      <Subrayado className="text-rosa-400 mt-1.5" />
    </Revelar>
  )
}
