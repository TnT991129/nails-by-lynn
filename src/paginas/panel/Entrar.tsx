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
        <div className="text-center mb-6">
          <h1 className="font-display text-[30px]">Nails by Lynn</h1>
          <p className="text-[14px] text-tinta-tenue">Panel de gestión</p>
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
