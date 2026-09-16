import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from 'react'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro'

const ESTILOS: Record<Variante, string> = {
  primario:   'bg-rosa-600 text-white hover:bg-rosa-700 active:bg-rosa-800 shadow-md',
  secundario: 'bg-white text-rosa-800 border border-rosa-200 hover:bg-rosa-50',
  fantasma:   'bg-transparent text-tinta-suave hover:bg-rosa-50',
  peligro:    'bg-white text-estado-error border border-estado-error hover:bg-red-50',
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
      className={[
        'min-h-[48px] px-6 rounded font-medium text-[16px] transition-colors duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2',
        ESTILOS[variante], ancho ? 'w-full' : '', props.className ?? '',
      ].join(' ')}
    >
      {cargando && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-lg shadow-md p-5 ${className}`}>{children}</div>
}

export function Etiqueta({ children }: { children: ReactNode }) {
  return (
    <span className="text-[12px] font-medium tracking-[0.18em] uppercase text-tinta-tenue">
      {children}
    </span>
  )
}

const PILDORAS: Record<string, string> = {
  CONFIRMADA:        'bg-[#E6F4EF] text-estado-exito',
  PENDIENTE:         'bg-[#FDF3E3] text-estado-aviso',
  COMPLETADA:        'bg-rosa-50 text-rosa-800',
  EN_CURSO:          'bg-rosa-100 text-rosa-800',
  CANCELADA_CLIENTA: 'bg-superficie-base text-tinta-tenue',
  CANCELADA_NEGOCIO: 'bg-superficie-base text-tinta-tenue',
  NO_SHOW:           'bg-[#FBEAEA] text-estado-error',
}

const NOMBRES: Record<string, string> = {
  CONFIRMADA:'Confirmada', PENDIENTE:'Pendiente', COMPLETADA:'Completada',
  EN_CURSO:'En curso', CANCELADA_CLIENTA:'Cancelada',
  CANCELADA_NEGOCIO:'Cancelada', NO_SHOW:'No asististe',
}

export function Pildora({ estado }: { estado: string }) {
  return (
    <span className={`text-[12px] font-medium px-3 py-1 rounded-full ${PILDORAS[estado] ?? PILDORAS.PENDIENTE}`}>
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
        className={`w-full min-h-[48px] px-4 rounded-sm border text-[16px] bg-white
          ${error ? 'border-estado-error' : 'border-rosa-200'}
          placeholder:text-tinta-tenue/60`}
      />
      {error
        ? <span className="block text-[14px] text-estado-error mt-1.5">{error}</span>
        : ayuda && <span className="block text-[14px] text-tinta-tenue mt-1.5">{ayuda}</span>}
    </label>
  )
}

export function Esqueleto({ className = '' }: { className?: string }) {
  return <div className={`bg-rosa-100 rounded animate-pulso ${className}`} />
}

export function Vacio({
  titulo, texto, children,
}: { titulo: string; texto: string; children?: ReactNode }) {
  return (
    <div className="text-center py-12 px-6 animate-entrada">
      <div className="w-14 h-14 rounded-full bg-rosa-100 mx-auto mb-4" aria-hidden />
      <h3 className="text-[19px] font-semibold mb-2">{titulo}</h3>
      <p className="text-tinta-tenue mb-6 max-w-xs mx-auto">{texto}</p>
      {children}
    </div>
  )
}

export function Aviso({ tipo = 'error', children }: { tipo?: 'error' | 'aviso'; children: ReactNode }) {
  const c = tipo === 'error'
    ? 'bg-[#FBEAEA] text-estado-error' : 'bg-[#FDF3E3] text-estado-aviso'
  return <div role="alert" className={`rounded p-4 text-[14px] animate-entrada ${c}`}>{children}</div>
}
