import { NavLink, useLocation } from 'react-router-dom'

const ITEMS = [
  { a: '/', etiqueta: 'Inicio', icono: '⌂' },
{ a: '/servicios', etiqueta: 'Servicios', icono: '💅' },
{ a: '/galeria', etiqueta: 'Galería', icono: '📷' },
{ a: '/mis-citas', etiqueta: 'Mis citas', icono: '📅' },
]

export default function Navegacion() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/reservar') || pathname.startsWith('/panel')) return null

  return (
    <nav className="bottom-0 z-20 fixed inset-x-0 pb-[env(safe-area-inset-bottom)] bg-white border-rosa-100 border-t">
      <ul className="flex">
        {ITEMS.map(i => (
          <li key={i.a} className="flex-1">
            <NavLink to={i.a} end={i.a === '/'}
              className={({ isActive }) =>
                `h-16 flex flex-col items-center justify-center gap-0.5
                 ${isActive ? 'text-rosa-600' : 'text-tinta-tenue'}`}>
              <span className="text-[20px]" aria-hidden>{i.icono}</span>
              <span className="text-[11px]">{i.etiqueta}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
