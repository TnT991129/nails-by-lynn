import { NavLink, Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { IconoInicio, IconoGaleria, IconoCalendario, IconoMas } from './iconos'
import { useTextos } from '../lib/textos'

function Item({ a, etiqueta, icono }: { a: string; etiqueta: string; icono: ReactNode }) {
  return (
    <li className="flex-1">
      <NavLink to={a} end={a === '/'}
        className={({ isActive }) =>
          `group h-16 flex flex-col items-center justify-center gap-1 transition-colors
           ${isActive ? 'text-rosa-600' : 'text-tinta-tenue hover:text-tinta-suave'}`}>
        {({ isActive }) => (
          <>
            {/* Píldora de fondo que aparece bajo el icono de la página actual */}
            <span className="relative flex items-center justify-center w-14 h-8">
              <span aria-hidden className={`absolute inset-0 rounded-full bg-rosa-100 transition duration-300 ease-out
                ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} />
              <span className={`relative transition-transform duration-300 group-active:scale-90
                ${isActive ? '-translate-y-px' : ''}`}>{icono}</span>
            </span>
            <span className={`text-[11px] leading-none ${isActive ? 'font-semibold' : ''}`}>{etiqueta}</span>
          </>
        )}
      </NavLink>
    </li>
  )
}

export default function Navegacion() {
  const { pathname } = useLocation()
  const t = useTextos()
  if (pathname.startsWith('/reservar') || pathname.startsWith('/panel')) return null

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-papel/85 backdrop-blur-lg border-t border-rosa-100/80
                    shadow-flota pb-[env(safe-area-inset-bottom)] animate-pagina">
      <ul className="flex items-center max-w-lg mx-auto px-2">
        <Item a="/" etiqueta={t('menu.inicio')} icono={<IconoInicio />} />
        <Item a="/galeria" etiqueta={t('menu.galeria')} icono={<IconoGaleria />} />
        <li className="flex-1 flex justify-center">
          <Link to="/reservar" aria-label="Reservar cita"
            className="group onda h-12 px-4 rounded-full bg-gradient-to-br from-rosa-600 to-vino text-white shadow-boton
                       inline-flex items-center gap-1.5 text-[13px] font-semibold
                       hover:-translate-y-0.5 active:scale-95 transition duration-200">
            <IconoMas tam={18} strokeWidth={2.4} className="transition-transform duration-300 group-hover:rotate-90" />
            {t('menu.reservar')}
          </Link>
        </li>
        <Item a="/mis-citas" etiqueta={t('menu.mis_citas')} icono={<IconoCalendario />} />
      </ul>
    </nav>
  )
}
