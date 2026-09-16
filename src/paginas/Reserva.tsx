import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { obtenerServicios, obtenerAddons, obtenerDisponibilidad } from '../lib/api'
import { useReserva } from '../caracteristicas/reserva/useReserva'
import { Progreso, PasoServicio, PasoFecha, PasoHora, PasoDatos, PasoResumen }
  from '../caracteristicas/reserva/Pasos'
import { validarNombre, validarTelefono, validarEmail } from '../caracteristicas/reserva/validacion'
import { Boton, Esqueleto, Aviso } from '../componentes/ui'
import { duracion, dinero } from '../lib/formato'
import { mensajeDeError, codigoDeError } from '../lib/errores'

export default function Reserva() {
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const [intentado, setIntentado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const qServicios = useQuery({ queryKey:['servicios'], queryFn: obtenerServicios })
  const qAddons = useQuery({ queryKey:['addons'], queryFn: obtenerAddons })

  const r = useReserva(qServicios.data ?? [], qAddons.data ?? [])

  // Preseleccion desde "QUIERO ESTE DISEÑO" o desde la tarjeta de servicio
  useEffect(() => {
    const pre = params.get('servicio')
    if (pre && qServicios.data && !r.seleccionados.length) {
      const s = qServicios.data.find(x => x.slug === pre || x.id === pre)
      if (s) r.alternarServicio(s.id)
    }
  }, [params, qServicios.data])

  const qHoras = useQuery({
    queryKey: ['disponibilidad', r.fecha, r.duracionTotal, r.bufferTotal],
    queryFn: () => obtenerDisponibilidad(r.fecha!, r.duracionTotal, r.bufferTotal || undefined),
    enabled: r.paso === 3 && !!r.fecha && r.duracionTotal > 0,
  })

  async function elegirHora(h: string) {
    setError(null)
    try { await r.retener(h) }
    catch (e) { setError(mensajeDeError(e)); qHoras.refetch() }
  }

  async function confirmar() {
    setIntentado(true)
    setError(null)
    const fallo = validarNombre(r.datos.nombre) ?? validarTelefono(r.datos.telefono)
                ?? validarEmail(r.datos.email)
    if (fallo) { r.setPaso(4); return }
    if (!r.aceptaPoliticas) { setError('Acepta las políticas para continuar.'); return }
    setEnviando(true)
    try {
      const cita = await r.confirmar()
      navegar(`/cita/${cita.access_token}?nueva=1`)
    } catch (e) {
      const codigo = codigoDeError(e)
      setError(mensajeDeError(e))
      if (codigo === 'HORARIO_YA_TOMADO' || codigo === 'RETENCION_VENCIDA') {
        r.volverAHora(); qHoras.refetch()
      }
    } finally { setEnviando(false) }
  }

  if (qServicios.isLoading) {
    return <div className="p-5 space-y-3">
      {Array.from({length:4}).map((_,i) => <Esqueleto key={i} className="h-24" />)}
    </div>
  }
  if (qServicios.isError) {
    return <div className="p-5"><Aviso>{mensajeDeError(qServicios.error)}</Aviso></div>
  }

  const puedeSeguir =
    (r.paso === 1 && r.seleccionados.length > 0) ||
    (r.paso === 2 && !!r.fecha) ||
    (r.paso === 3 && !!r.inicio) ||
    r.paso === 4 || r.paso === 5

  return (
    <div className="min-h-dvh flex flex-col bg-superficie-base">
      <header className="bg-white border-b border-rosa-100 pt-3 sticky top-0 z-10">
        <div className="flex items-center justify-between px-5 pb-1">
          <button onClick={() => r.paso === 1 ? navegar('/') : r.setPaso((r.paso - 1) as 1)}
                  className="text-tinta-suave text-[16px] min-h-[44px]" aria-label="Volver">←</button>
          <span className="text-[16px] font-medium">Reservar cita</span>
          <button onClick={() => navegar('/')} className="text-tinta-suave text-[16px] min-h-[44px]"
                  aria-label="Cerrar">✕</button>
        </div>
        <Progreso paso={r.paso} />
      </header>

      <main className="flex-1 px-5 py-6">
        {error && <div className="mb-4"><Aviso>{error}</Aviso></div>}

        {r.paso === 1 && (
          <PasoServicio servicios={qServicios.data ?? []} seleccionados={r.seleccionados}
            alternar={r.alternarServicio} addons={r.addonsAplicables}
            addonsElegidos={r.addonsElegidos} alternarAddon={r.alternarAddon} />
        )}
        {r.paso === 2 && <PasoFecha fecha={r.fecha} setFecha={r.setFecha} />}
        {r.paso === 3 && (
          <PasoHora horas={qHoras.data ?? []} cargando={qHoras.isLoading}
            error={qHoras.isError ? mensajeDeError(qHoras.error) : null}
            inicio={r.inicio} onElegir={elegirHora} expiraEn={r.expiraEn} />
        )}
        {r.paso === 4 && <PasoDatos datos={r.datos} setDatos={r.setDatos} intentado={intentado} />}
        {r.paso === 5 && r.inicio && (
          <PasoResumen servicios={r.serviciosElegidos}
            addons={r.addonsAplicables.filter(a => r.addonsElegidos.includes(a.id))}
            inicio={r.inicio} duracionMin={r.duracionTotal} total={r.precioTotal}
            acepta={r.aceptaPoliticas} setAcepta={r.setAceptaPoliticas}
            politica={null} />
        )}
      </main>

      <footer className="sticky bottom-0 bg-white border-t border-rosa-100 px-5 py-3 pb-[env(safe-area-inset-bottom)]">
        {r.duracionTotal > 0 && (
          <p className="text-[14px] text-tinta-tenue mb-2 truncate">
            {r.serviciosElegidos.map(s => s.name).join(' + ')} · {duracion(r.duracionTotal)}
            {r.precioTotal > 0 && ` · ${dinero(r.precioTotal)}`}
          </p>
        )}
        <Boton ancho cargando={enviando} disabled={!puedeSeguir}
          onClick={() => r.paso === 5 ? confirmar() : r.setPaso((r.paso + 1) as 2)}>
          {r.paso === 5 ? 'Confirmar cita' : 'Continuar'}
        </Boton>
      </footer>
    </div>
  )
}
