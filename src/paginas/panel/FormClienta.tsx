import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerClienta, crearClienta, actualizarClienta } from '../../lib/panel/api-panel'
import { validarNombre, validarTelefono, validarEmail } from '../../caracteristicas/reserva/validacion'
import { Boton, Campo, Aviso, Esqueleto } from '../../componentes/ui'
import { mensajeDeError } from '../../lib/errores'
import { Volver } from './comunes'

// Alta y edición de clientas. Sin :id en la ruta es una clienta nueva.
export default function FormClienta() {
  const { id } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [instagram, setInstagram] = useState('')
  const [cargada, setCargada] = useState(false)
  const [intentado, setIntentado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const q = useQuery({ queryKey: ['cli', id], queryFn: () => obtenerClienta(id!), enabled: !!id })

  if (q.data && !cargada) {
    setNombre(q.data.full_name)
    setTelefono(q.data.phone)
    setEmail(q.data.email ?? '')
    setInstagram(q.data.instagram ?? '')
    setCargada(true)
  }

  const errNombre = validarNombre(nombre)
  const errTelefono = validarTelefono(telefono)
  const errEmail = validarEmail(email)

  async function guardar() {
    setIntentado(true)
    if (errNombre || errTelefono || errEmail) return
    setGuardando(true); setError(null)
    const datos = {
      full_name: nombre.trim(),
      phone: telefono.trim(),
      email: email.trim() || null,
      instagram: instagram.trim().replace(/^@/, '') || null,
    }
    try {
      if (id) {
        await actualizarClienta(id, datos)
        qc.invalidateQueries()
        navegar(`/panel/clientas/${id}`, { replace: true })
      } else {
        const r = await crearClienta(datos)
        qc.invalidateQueries({ queryKey: ['clientas'] })
        navegar(`/panel/clientas/${r.id}`, { replace: true })
      }
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  if (id && q.isLoading) return <div className="p-5"><Esqueleto className="h-48" /></div>
  if (id && q.isError) return <div className="p-5"><Aviso>{mensajeDeError(q.error)}</Aviso></div>

  return (
    <div className="p-5 space-y-4">
      <Volver />
      <h1 className="text-[30px] leading-tight">{id ? 'Editar clienta' : 'Nueva clienta'}</h1>

      <Campo etiqueta="Nombre" value={nombre} onChange={e => setNombre(e.target.value)}
        autoComplete="off" error={intentado ? errNombre ?? undefined : undefined} />
      <Campo etiqueta="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)}
        inputMode="tel" placeholder="5XXXXXXX" autoComplete="off"
        error={intentado ? errTelefono ?? undefined : undefined} />
      <Campo etiqueta="Email (opcional)" value={email} onChange={e => setEmail(e.target.value)}
        inputMode="email" autoComplete="off" error={intentado ? errEmail ?? undefined : undefined} />
      <Campo etiqueta="Instagram (opcional)" value={instagram} onChange={e => setInstagram(e.target.value)}
        placeholder="@usuario" autoComplete="off" />

      {error && <Aviso>{error}</Aviso>}

      <Boton ancho onClick={guardar} cargando={guardando}>
        {id ? 'Guardar cambios' : 'Crear clienta'}
      </Boton>
    </div>
  )
}
