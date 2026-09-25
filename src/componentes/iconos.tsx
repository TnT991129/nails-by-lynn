// Iconos de trazo en SVG (sustituyen a los emojis, que cambian de aspecto según el móvil)
import type { SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement> & { tam?: number }

function Base({ tam = 22, children, ...props }: Props) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {children}
    </svg>
  )
}

export const IconoInicio = (p: Props) => (
  <Base {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-6h4v6" /></Base>
)
export const IconoGaleria = (p: Props) => (
  <Base {...p}><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="9" cy="9" r="2" /><path d="m21 15-4.5-4.5L6 21" /></Base>
)
export const IconoCalendario = (p: Props) => (
  <Base {...p}><rect x="3" y="4.5" width="18" height="16.5" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></Base>
)
export const IconoMas = (p: Props) => (
  <Base {...p}><path d="M12 5v14M5 12h14" /></Base>
)
export const IconoAtras = (p: Props) => (
  <Base {...p}><path d="M15 5l-7 7 7 7" /></Base>
)
export const IconoFlecha = (p: Props) => (
  <Base {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Base>
)
export const IconoCerrar = (p: Props) => (
  <Base {...p}><path d="M6 6l12 12M18 6 6 18" /></Base>
)
export const IconoCheck = (p: Props) => (
  <Base {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Base>
)
export const IconoReloj = (p: Props) => (
  <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Base>
)
export const IconoUbicacion = (p: Props) => (
  <Base {...p}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></Base>
)
export const IconoSol = (p: Props) => (
  <Base {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></Base>
)
export const IconoTarde = (p: Props) => (
  <Base {...p}><path d="M17 18a5 5 0 0 0-10 0" /><path d="M12 9.5v-2M5.3 11.3 6.7 12.7M18.7 11.3l-1.4 1.4M2.5 18h19M8 21.5h8" /></Base>
)
export const IconoDestellos = (p: Props) => (
  <Base {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" /></Base>
)
export const IconoWhatsApp = ({ tam = 22, ...p }: Props) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M17.5 14.4c-.3-.15-1.7-.85-2-.95s-.5-.15-.7.15-.8.95-1 1.15-.35.2-.65.05-1.25-.45-2.4-1.45c-.9-.8-1.5-1.75-1.65-2.05s-.05-.45.1-.6c.15-.15.3-.35.45-.55s.2-.3.3-.5.05-.35 0-.5-.7-1.7-1-2.35c-.25-.6-.5-.55-.7-.55h-.6c-.2 0-.55.05-.85.4s-1.1 1.05-1.1 2.55 1.15 2.95 1.3 3.15c.15.2 2.25 3.45 5.5 4.85.75.35 1.35.55 1.85.7.75.25 1.45.2 2 .1.6-.1 1.7-.7 2-1.35s.3-1.2.2-1.35c-.1-.15-.3-.25-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 4.95L2 22l5.25-1.35C8.65 21.5 10.3 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2z" />
  </svg>
)
