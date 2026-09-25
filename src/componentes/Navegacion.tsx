import { NavLink, Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { IconoInicio, IconoGaleria, IconoCalendario, IconoMas } from './iconos'

function Item({ a, etiqueta, icono }: { a: string; etiqueta: string; icono: ReactNode }) {
  return (
    <li className="flex-1">
      <NavLink to={a} end={a === '/'}
        className={({ isActive }) =>
          `h-16 flex flex-col items-center justify-center gap-1 transition-colors
           ${isActive ? 'text-rosa-600' : 'text-tinta-tenue'}`}>
        {({ isActive }) => (
          <>
            {icono}
            <span className={`text-[11px] ${isActive ? 'font-semibold' : ''}`}>{etiqueta}</span>
          </>
        )}
      </NavLink>
    </li>
  )
}

export default function Navegacion() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/reservar') || pathname.startsWith('/panel')) return null

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-white/90 backdrop-blur-md border-t border-rosa-100
                    shadow-flota pb-[env(safe-area-inset-bottom)]">
      <ul className="flex items-center max-w-lg mx-auto px-2">
        <Item a="/" etiqueta="Inicio" icono={<IconoInicio />} />
        <Item a="/galeria" etiqueta="Galería" icono={<IconoGaleria />} />
        <li className="flex-1 flex justify-center">
          <Link to="/reservar" aria-label="Reservar cita"
            className="h-12 px-4 rounded-full bg-rosa-600 text-white shadow-boton
                       inline-flex items-center gap-1.5 text-[13px] font-semibold active:scale-95 transition">
            <IconoMas tam={18} strokeWidth={2.4} />
            Reservar
          </Link>
        </li>
        <Item a="/mis-citas" etiqueta="Mis citas" icono={<IconoCalendario />} />
      </ul>
    </nav>
  )
}
