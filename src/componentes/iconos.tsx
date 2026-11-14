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
export const IconoPersonas = (p: Props) => (
  <Base {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-3-5.5" /></Base>
)
export const IconoCuadricula = (p: Props) => (
  <Base {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></Base>
)
export const IconoGrafico = (p: Props) => (
  <Base {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Base>
)
export const IconoBillete = (p: Props) => (
  <Base {...p}><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v5M18 9.5v5" /></Base>
)
export const IconoDescarga = (p: Props) => (
  <Base {...p}><path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5" /><path d="M4 16.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-2.5" /></Base>
)
export const IconoSalir = (p: Props) => (
  <Base {...p}><path d="M14 4.5h3.5A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5H14" /><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15" /></Base>
)
export const IconoLuna = (p: Props) => (
  <Base {...p}><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" /></Base>
)

// ---------- Panel: un icono propio para cada opción ----------
export const IconoRegalo = (p: Props) => (
  <Base {...p}><rect x="3.5" y="9" width="17" height="11.5" rx="2" /><path d="M2.5 9h19M12 9v11.5" /><path d="M12 9c-1.5-4-6-4.5-6-1.8C6 9 9.5 9 12 9zM12 9c1.5-4 6-4.5 6-1.8C18 9 14.500 9 12 9z" /></Base>
)
export const IconoEstrella = (p: Props) => (
  <Base {...p}><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.200-2.800-5.200 2.800 1-5.900L3.500 9.700l5.900-.8z" /></Base>
)
export const IconoTarjeta = (p: Props) => (
  <Base {...p}><rect x="2.5" y="5" width="19" height="14" rx="3" /><circle cx="8" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="16" cy="12" r="1.3" /></Base>
)
export const IconoPaleta = (p: Props) => (
  <Base {...p}><path d="M12 3.500a8.500 8.500 0 1 0 0 17c1.400 0 2-1 1.500-2.200-.6-1.400.2-2.800 1.800-2.800H17a3.500 3.500 0 0 0 3.500-3.500c0-4.700-3.800-8.500-8.500-8.500z" /><circle cx="8" cy="11" r="1" /><circle cx="11" cy="7.500" r="1" /><circle cx="15.500" cy="8.500" r="1" /></Base>
)
export const IconoTexto = (p: Props) => (
  <Base {...p}><path d="M5 6.500V5h14v1.500M12 5v14M9 19h6" /></Base>
)
export const IconoEscudo = (p: Props) => (
  <Base {...p}><path d="M12 3 4.500 6v5.500c0 4.500 3 8 7.500 9.500 4.500-1.500 7.500-5 7.500-9.500V6z" /><path d="m9 12 2.200 2.200L15 10.400" /></Base>
)
export const IconoCampana = (p: Props) => (
  <Base {...p}><path d="M6 10a6 6 0 0 1 12 0c0 5 2 6.500 2 6.500H4S6 15 6 10z" /><path d="M10 20a2.200 2.200 0 0 0 4 0" /></Base>
)
export const IconoAbajo = (p: Props) => (
  <Base {...p}><path d="m6 9 6 6 6-6" /></Base>
)
