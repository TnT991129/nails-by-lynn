import { useEffect, useState } from 'react'

// Instalación del panel como app en el móvil (PWA).
// Chrome/Android avisa con "beforeinstallprompt"; lo guardamos para lanzar la instalación desde un botón.
// En iPhone no existe ese aviso: se instala desde Safari → Compartir → "Añadir a pantalla de inicio".

type EventoInstalar = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let evento: EventoInstalar | null = null
const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach(f => f())

/** Se llama una vez al arrancar la app (main.tsx), antes de que Chrome lance el aviso */
export function escucharInstalacion() {
  window.addEventListener('beforeinstallprompt', e => {
    // En la web de clientas Chrome actúa como siempre; solo el panel usa su propio botón
    if (!location.pathname.includes('/panel')) return
    e.preventDefault()
    evento = e as EventoInstalar
    avisar()
  })
  window.addEventListener('appinstalled', () => { evento = null; avisar() })
}

export function yaInstalada(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function esIPhone(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function useInstalar() {
  const [, forzar] = useState(0)
  useEffect(() => {
    const f = () => forzar(n => n + 1)
    oyentes.add(f)
    return () => { oyentes.delete(f) }
  }, [])

  return {
    puedeInstalar: !!evento,
    async instalar() {
      if (!evento) return false
      await evento.prompt()
      const { outcome } = await evento.userChoice
      evento = null
      avisar()
      return outcome === 'accepted'
    },
  }
}

/** Mientras se está en el panel, el navegador ve el manifiesto y el icono del panel */
export function usarIdentidadPanel() {
  useEffect(() => {
    const BASE = import.meta.env.BASE_URL
    const cambios: [Element | null, string, string][] = [
      [document.querySelector('link[rel="manifest"]'), 'href', `${BASE}manifest-panel.json`],
      [document.querySelector('link[rel="apple-touch-icon"]'), 'href', `${BASE}icono-panel-180.png`],
      [document.querySelector('meta[name="apple-mobile-web-app-title"]'), 'content', 'Panel Lynn'],
      [document.querySelector('meta[name="theme-color"]'), 'content', '#2B1721'],
    ]
    const antes = cambios.map(([el, attr]) => el?.getAttribute(attr) ?? null)
    cambios.forEach(([el, attr, valor]) => el?.setAttribute(attr, valor))
    return () => cambios.forEach(([el, attr], i) => { if (el && antes[i] !== null) el.setAttribute(attr, antes[i]!) })
  }, [])
}
