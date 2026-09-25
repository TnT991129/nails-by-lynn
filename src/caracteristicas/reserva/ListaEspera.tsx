import { useState } from 'react'
import { unirseListaEspera } from '../../lib/api'
import { Boton, Campo, Aviso } from '../../componentes/ui'
import { IconoCheck } from '../../componentes/iconos'
import { fechaLarga } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'
import { validarNombre, validarTelefono } from './validacion'

// Se muestra cuando un día no tiene turnos: la clienta pide que la avisen si alguien cancela
export default function ListaEspera({ fecha, servicioId, nombreInicial = '', telefonoInicial = '' }: {
  fecha: string; servicioId?: string; nombreInicial?: string; telefonoInicial?: string
}) {
  const [abierta, setAbierta] = useState(false)
  const [nombre, setNombre] = useState(nombreInicial)
  const [telefono, setTelefono] = useState(telefonoInicial)
  const [intentado, setIntentado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)

  const dia = fechaLarga(`${fecha}T16:00:00Z`)

  async function apuntarme() {
    setIntentado(true)
    if (validarNombre(nombre) || validarTelefono(telefono)) return
    setEnviando(true); setError(null)
    try {
      await unirseListaEspera(fecha, nombre.trim(), telefono.trim(), servicioId)
      setListo(true)
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setEnviando(false) }
  }

  if (listo) {
    return (
      <div className="text-left bg-rosa-50 border border-rosa-100 rounded-xl p-4 flex gap-3 animate-entrada">
        <span className="w-8 h-8 rounded-full bg-rosa-600 text-white flex items-center justify-center shrink-0">
          <IconoCheck tam={16} strokeWidth={3} />
        </span>
        <p className="text-[14px] text-tinta-suave">
          <b>¡Estás en la lista!</b> Si se libera un turno el {dia}, Lynn te escribirá por WhatsApp.
          Mientras, puedes elegir otro día.
        </p>
      </div>
    )
  }

  if (!abierta) {
    return (
      <Boton variante="secundario" onClick={() => setAbierta(true)}>
        Avísame si se libera un turno
      </Boton>
    )
  }

  return (
    <div className="text-left bg-white border border-rosa-100 rounded-xl p-4 space-y-3 animate-entrada">
      <p className="text-[14px] text-tinta-suave">
        Te apuntamos para el <b>{dia}</b>. Si alguien cancela, Lynn te avisa por WhatsApp.
      </p>
      <Campo etiqueta="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} autoComplete="name"
             error={intentado ? validarNombre(nombre) ?? undefined : undefined} />
      <Campo etiqueta="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)}
             inputMode="tel" autoComplete="tel" placeholder="5455 9179"
             error={intentado ? validarTelefono(telefono) ?? undefined : undefined} />
      {error && <Aviso>{error}</Aviso>}
      <Boton ancho cargando={enviando} onClick={apuntarme}>Apuntarme a la lista de espera</Boton>
    </div>
  )
}
