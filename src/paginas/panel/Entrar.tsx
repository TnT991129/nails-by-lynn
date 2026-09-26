import { useState } from 'react'
import { sb } from '../../lib/panel/supabase-panel'
import { Boton, Campo, Aviso } from '../../componentes/ui'

export default function Entrar() {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setCargando(true)
    const { error } = await sb.auth.signInWithPassword({
      email: correo.trim(), password: contrasena,
    })
    setCargando(false)
    if (error) setError(
      error.message.includes('Invalid') ? 'Correo o contraseña incorrectos.' : error.message
    )
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-5 bg-superficie-base">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 animate-entrada">
        <div className="text-center mb-8">
          <picture>
            <source srcSet={`${import.meta.env.BASE_URL}logo-horizontal-rosa.webp`} type="image/webp" />
            <img src={`${import.meta.env.BASE_URL}logo-horizontal-rosa.png`} alt="Nails by Lynn"
                 width={160} height={70} className="h-16 w-auto mx-auto" />
          </picture>
          <h1 className="sr-only">Nails by Lynn</h1>
          <p className="text-[12px] font-semibold tracking-[0.2em] uppercase text-tinta-tenue mt-4">Panel de gestión</p>
        </div>
        {error && <Aviso>{error}</Aviso>}
        <Campo etiqueta="Correo" type="email" value={correo}
               onChange={e => setCorreo(e.target.value)} required autoComplete="email" />
        <Campo etiqueta="Contraseña" type="password" value={contrasena}
               onChange={e => setContrasena(e.target.value)} required autoComplete="current-password" />
        <Boton ancho type="submit" cargando={cargando}>Entrar</Boton>
      </form>
    </div>
  )
}
