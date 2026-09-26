import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { obtenerServicios, obtenerAddons, obtenerDisponibilidad, obtenerDiasLaborables, obtenerDiasCerrados, descuentoPendiente } from '../lib/api'
import ListaEspera from '../caracteristicas/reserva/ListaEspera'
import { useReserva } from '../caracteristicas/reserva/useReserva'
import { Progreso, PasoServicio, PasoExtras, PasoFecha, PasoHora, PasoDatos, PasoResumen }
  from '../caracteristicas/reserva/Pasos'
import { validarNombre, validarTelefono, validarEmail } from '../caracteristicas/reserva/validacion'
import { Boton, Esqueleto, Aviso } from '../componentes/ui'
import { IconoAtras, IconoCerrar } from '../componentes/iconos'
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
  const qDias = useQuery({ queryKey:['dias-laborables'], queryFn: obtenerDiasLaborables })
  const qCerrados = useQuery({ queryKey:['dias-cerrados'], queryFn: obtenerDiasCerrados })

  const r = useReserva(qServicios.data ?? [], qAddons.data ?? [])

  // Preseleccion desde "QUIERO ESTE DISEÑO" o desde la tarjeta de servicio
  useEffect(() => {
    const pre = params.get('servicio')
    if (pre && qServicios.data && !r.seleccionados.length) {
      const s = qServicios.data.find(x => x.slug === pre || x.id === pre)
      if (s) r.alternarServicio(s.id)
    }
  }, [params, qServicios.data])

  // ¿Lynn le dejó un descuento a este teléfono? Se muestra en el resumen; el servidor lo aplica al confirmar
  const qDescuento = useQuery({
    queryKey: ['descuento', r.datos.telefono],
    queryFn: () => descuentoPendiente(r.datos.telefono),
    enabled: r.paso === 6 && !validarTelefono(r.datos.telefono),
  })
  const precioMostrado = qDescuento.data && r.paso === 6
    ? r.precioTotal - Math.round(r.precioTotal * qDescuento.data) / 100
    : r.precioTotal

  const qHoras = useQuery({
    queryKey: ['disponibilidad', r.fecha, r.duracionTotal, r.bufferTotal],
    queryFn: () => obtenerDisponibilidad(r.fecha!, r.duracionTotal, r.bufferTotal || undefined),
    enabled: r.paso === 4 && !!r.fecha && r.duracionTotal > 0,
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
    if (fallo) { r.setPaso(5); return }
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
    r.paso === 2 ||                          // extras es opcional
    (r.paso === 3 && !!r.fecha) ||
    (r.paso === 4 && !!r.inicio) ||
    r.paso === 5 || r.paso === 6

  return (
    <div className="min-h-dvh flex flex-col bg-superficie-base">
      <header className="bg-white/90 backdrop-blur-md border-b border-rosa-100 pt-3 sticky top-0 z-10">
        <div className="flex items-center justify-between px-3 pb-2">
          <button onClick={() => r.paso === 1 ? navegar('/') : r.setPaso((r.paso - 1) as 1)}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-tinta-suave hover:bg-rosa-50"
                  aria-label="Volver"><IconoAtras /></button>
          <span className="font-display text-[19px]">Reservar cita</span>
          <button onClick={() => navegar('/')}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-tinta-suave hover:bg-rosa-50"
                  aria-label="Cerrar"><IconoCerrar /></button>
        </div>
        <Progreso paso={r.paso} />
      </header>

      <main className="flex-1 px-5 py-6">
        {error && <div className="mb-4"><Aviso>{error}</Aviso></div>}

        {r.paso === 1 && (
          <PasoServicio servicios={qServicios.data ?? []} seleccionados={r.seleccionados}
            alternar={r.alternarServicio} />
        )}
        {r.paso === 2 && (
          <PasoExtras addons={r.addonsAplicables}
            addonsElegidos={r.addonsElegidos} alternarAddon={r.alternarAddon} />
        )}
        {r.paso === 3 && <PasoFecha fecha={r.fecha} setFecha={r.setFecha} diasLaborables={qDias.data} diasCerrados={qCerrados.data} />}
        {r.paso === 4 && (
          <PasoHora horas={qHoras.data ?? []} cargando={qHoras.isLoading}
            error={qHoras.isError ? mensajeDeError(qHoras.error) : null}
            inicio={r.inicio} onElegir={elegirHora} expiraEn={r.expiraEn}
            siNoHay={r.fecha && <ListaEspera key={r.fecha} fecha={r.fecha} servicioId={r.seleccionados[0]}
                                   nombreInicial={r.datos.nombre} telefonoInicial={r.datos.telefono} />} />
        )}
        {r.paso === 5 && <PasoDatos datos={r.datos} setDatos={r.setDatos} intentado={intentado} />}
        {r.paso === 6 && r.inicio && (
          <PasoResumen servicios={r.serviciosElegidos}
            addons={r.addonsAplicables.filter(a => r.addonsElegidos.includes(a.id))}
            inicio={r.inicio} duracionMin={r.duracionTotal} total={r.precioTotal}
            acepta={r.aceptaPoliticas} setAcepta={r.setAceptaPoliticas} descuento={qDescuento.data} />
        )}
      </main>

      <footer className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-rosa-100 shadow-flota
                         px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {r.duracionTotal > 0 && (
          <div className="flex items-baseline justify-between gap-3 mb-2.5">
            <p className="text-[13px] text-tinta-tenue truncate">
              {r.serviciosElegidos.map(s => s.name).join(' + ')} · {duracion(r.duracionTotal)}
            </p>
            {r.precioTotal > 0 && (
              <span className="font-display text-[18px] text-rosa-700 shrink-0">{dinero(precioMostrado)}</span>
            )}
          </div>
        )}
        <Boton ancho cargando={enviando} disabled={!puedeSeguir}
          onClick={() => r.paso === 6 ? confirmar() : r.setPaso((r.paso + 1) as 2)}>
          {r.paso === 6 ? 'Confirmar cita' : (r.paso === 2 && r.addonsElegidos.length === 0 ? 'Continuar sin extras' : 'Continuar')}
        </Boton>
      </footer>
    </div>
  )
}
