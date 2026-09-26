import type { ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { sb } from '../../lib/panel/supabase-panel'
import { IconoInicio, IconoCalendario, IconoPersonas, IconoCuadricula, IconoSalir } from '../../componentes/iconos'

const ITEMS: { a: string; etiqueta: string; icono: ReactNode }[] = [
  { a: '/panel',          etiqueta: 'Hoy',      icono: <IconoInicio /> },
  { a: '/panel/agenda',   etiqueta: 'Agenda',   icono: <IconoCalendario /> },
  { a: '/panel/clientas', etiqueta: 'Clientas', icono: <IconoPersonas /> },
  { a: '/panel/mas',      etiqueta: 'Más',      icono: <IconoCuadricula /> },
]

export default function Marco() {
  const navegar = useNavigate()
  const BASE = import.meta.env.BASE_URL
  async function salir() {
    await sb.auth.signOut()
    navegar('/panel/entrar')
  }
  return (
    <div className="min-h-dvh bg-superficie-base">
      <header className="bg-white/90 backdrop-blur-md border-b border-rosa-100 px-4 py-2 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <picture>
            <source srcSet={`${BASE}logo-horizontal-rosa.webp`} type="image/webp" />
            <img src={`${BASE}logo-horizontal-rosa.png`} alt="Nails by Lynn" width={74} height={32} className="h-8 w-auto" />
          </picture>
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-tinta-tenue">Panel</span>
        </div>
        <button onClick={salir} aria-label="Salir"
          className="min-h-[44px] px-3 rounded-full flex items-center gap-1.5 text-[13px] text-tinta-tenue hover:bg-rosa-50">
          <IconoSalir tam={18} /> Salir
        </button>
      </header>
      <main className="pb-24"><Outlet /></main>
      <nav className="fixed bottom-0 inset-x-0 z-20 bg-white/90 backdrop-blur-md border-t border-rosa-100
                      shadow-flota pb-[env(safe-area-inset-bottom)]">
        <ul className="flex max-w-lg mx-auto">
          {ITEMS.map(i => (
            <li key={i.a} className="flex-1">
              <NavLink to={i.a} end={i.a === '/panel'}
                className={({ isActive }) =>
                  `h-16 flex flex-col items-center justify-center gap-1 transition-colors
                   ${isActive ? 'text-rosa-600' : 'text-tinta-tenue'}`}>
                {({ isActive }) => (
                  <>
                    <span className={`px-4 py-1 rounded-full transition-colors ${isActive ? 'bg-rosa-50' : ''}`}>
                      {i.icono}
                    </span>
                    <span className={`text-[11px] ${isActive ? 'font-semibold' : ''}`}>{i.etiqueta}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
