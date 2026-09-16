import { useEffect, useState } from 'react'
import { sb, type Session } from './supabase-panel'

export type EstadoSesion = 'cargando' | 'entrada' | 'con-sesion'

export function useSesion() {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [estado, setEstado] = useState<EstadoSesion>('cargando')

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setEstado(data.session ? 'con-sesion' : 'entrada')
    })
    const { data: sub } = sb.auth.onAuthStateChange((_evt, s) => {
      setSesion(s)
      setEstado(s ? 'con-sesion' : 'entrada')
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return { sesion, estado }
}
