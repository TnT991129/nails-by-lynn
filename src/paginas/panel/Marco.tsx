import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { sb } from '../../lib/panel/supabase-panel'

const ITEMS = [
  { a: '/panel',           etiqueta: 'Hoy',      icono: '⌂' },
  { a: '/panel/agenda',    etiqueta: 'Agenda',   icono: '📅' },
  { a: '/panel/clientas',  etiqueta: 'Clientas', icono: '👤' },
  { a: '/panel/mas',       etiqueta: 'Más',      icono: '⋯' },
]

export default function Marco() {
  const navegar = useNavigate()
  async function salir() {
    await sb.auth.signOut()
    navegar('/panel/entrar')
  }
  return (
    <div className="min-h-dvh bg-superficie-base">
      <header className="bg-white border-b border-rosa-100 px-5 py-3 flex items-center justify-between sticky top-0 z-10">
        <span className="font-display text-[19px]">Nails by Lynn</span>
        <button onClick={salir} className="text-[14px] text-tinta-tenue min-h-[44px]">Salir</button>
      </header>
      <main className="pb-24"><Outlet /></main>
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-rosa-100 z-20 pb-[env(safe-area-inset-bottom)]">
        <ul className="flex">
          {ITEMS.map(i => (
            <li key={i.a} className="flex-1">
              <NavLink to={i.a} end={i.a === '/panel'}
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
    </div>
  )
}
