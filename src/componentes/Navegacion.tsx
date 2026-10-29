import { NavLink, Link, useLocation } from 'react-router-dom'
import type { CSSProperties, ReactNode } from 'react'
import { IconoInicio, IconoGaleria, IconoCalendario, IconoMas } from './iconos'
import { useTextos } from '../lib/textos'

function Item({ a, etiqueta, icono }: { a: string; etiqueta: string; icono: ReactNode }) {
  return (
    <li className="flex-1 relative">
      <NavLink to={a} end={a === '/'}
        className={({ isActive }) =>
          `group h-16 flex flex-col items-center justify-center gap-1 transition-colors duration-300
           ${isActive ? 'text-rosa-600' : 'text-tinta-tenue hover:text-tinta-suave'}`}>
        {({ isActive }) => (
          <>
            <span className="relative flex items-center justify-center w-14 h-8">
              <span className={`transition-transform duration-500 ease-[cubic-bezier(.34,1.56,.64,1)] group-active:scale-90
                ${isActive ? '-translate-y-0.5 scale-110' : ''}`}>{icono}</span>
            </span>
            <span className={`text-[11px] leading-none transition-all duration-300 ${isActive ? 'font-semibold' : ''}`}>{etiqueta}</span>
          </>
        )}
      </NavLink>
    </li>
  )
}

// Columna de cada pestaña (las cuatro miden lo mismo); la de en medio es el botón de reservar
const COLUMNAS: Record<string, number> = { '/': 0, '/galeria': 1, '/mis-citas': 3 }

export default function Navegacion() {
  const { pathname } = useLocation()
  const t = useTextos()
  if (pathname.startsWith('/reservar') || pathname.startsWith('/panel')) return null
  const columna = COLUMNAS[pathname]

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-papel/80 backdrop-blur-xl border-t border-rosa-100/80
                    shadow-flota pb-[env(safe-area-inset-bottom)] animate-pagina">
      <ul className="relative flex items-center max-w-lg mx-auto px-2">
        {/* Píldora que se desliza hasta la pestaña de la página actual */}
        <span aria-hidden
          className={`absolute left-2 top-[8.5px] h-8 w-[calc((100%-1rem)/4)] flex justify-center pointer-events-none
                      transition-[transform,opacity] duration-500 ease-[cubic-bezier(.34,1.56,.64,1)]
                      ${columna === undefined ? 'opacity-0' : 'opacity-100'}`}
          style={{ transform: `translateX(${(columna ?? 0) * 100}%)` } as CSSProperties}>
          <span className="w-14 h-8 rounded-full bg-gradient-to-br from-rosa-100 to-rosa-200/70 shadow-[inset_0_0_0_1px_rgb(var(--rosa-200))]" />
        </span>
        <Item a="/" etiqueta={t('menu.inicio')} icono={<IconoInicio />} />
        <Item a="/galeria" etiqueta={t('menu.galeria')} icono={<IconoGaleria />} />
        <li className="flex-1 flex justify-center">
          <Link to="/reservar" aria-label="Reservar cita"
            className="group onda h-12 px-4 rounded-boton bg-gradient-to-br from-rosa-500 via-rosa-600 to-vino text-white shadow-boton
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
