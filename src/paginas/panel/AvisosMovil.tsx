import { useEffect, useState } from 'react'
import { Boton, Tarjeta, Aviso } from '../../componentes/ui'
import { EVENTOS, estadoAvisos, activarAvisos, desactivarAvisos, type EstadoAvisos, type Evento } from '../../lib/panel/avisos'
import { mensajeDeError } from '../../lib/errores'

const TODOS = EVENTOS.map(e => e.clave) as Evento[]

// Lynn decide si este móvil le avisa cuando una clienta reserva, cancela, cambia su cita…
export default function AvisosMovil() {
  const [estado, setEstado] = useState<EstadoAvisos | null>(null)
  const [elegidos, setElegidos] = useState<Evento[]>(TODOS)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  async function leer() {
    try {
      const e = await estadoAvisos()
      setEstado(e)
      if (e.tipo === 'activo') setElegidos(e.eventos)
    } catch (e) { setError(mensajeDeError(e)); setEstado({ tipo: 'inactivo' }) }
  }
  useEffect(() => { leer() }, [])

  function alternar(ev: Evento) {
    setElegidos(l => l.includes(ev) ? l.filter(x => x !== ev) : [...l, ev])
    setGuardado(false)
  }

  async function guardar() {
    if (elegidos.length === 0) { setError('Elige al menos un aviso, o apágalos.'); return }
    setTrabajando(true); setError(null); setGuardado(false)
    try { await activarAvisos(elegidos); await leer(); setGuardado(true) }
    catch (e) { setError(mensajeDeError(e)); await leer() }
    finally { setTrabajando(false) }
  }

  async function apagar() {
    setTrabajando(true); setError(null); setGuardado(false)
    try { await desactivarAvisos(); await leer() }
    catch (e) { setError(mensajeDeError(e)) }
    finally { setTrabajando(false) }
  }

  if (!estado || estado.tipo === 'no-disponible') return null

  const activo = estado.tipo === 'activo'
  return (
    <Tarjeta className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[16px] font-semibold">🔔 Avisos en este móvil</div>
        {activo && <span className="text-[12px] font-semibold text-estado-exito">Activados</span>}
      </div>

      {estado.tipo === 'instalar-ios' && (
        <p className="text-[14px] text-tinta-suave">
          En el iPhone, los avisos solo funcionan con el panel instalado: toca <b>Compartir</b> →
          <b> «Añadir a pantalla de inicio»</b> y abre el panel desde ese icono.
        </p>
      )}
      {estado.tipo === 'bloqueado' && (
        <p className="text-[14px] text-tinta-suave">
          Los avisos están bloqueados para el panel. Permítelos en los ajustes del navegador o del móvil
          y vuelve a esta pantalla.
        </p>
      )}

      {(estado.tipo === 'inactivo' || activo) && (
        <>
          <p className="text-[14px] text-tinta-suave">
            Te aviso aquí cuando una clienta haga algo. Lo que cambies tú desde el panel no te avisa.
          </p>
          <div className="space-y-1">
            {EVENTOS.map(e => (
              <label key={e.clave} className="flex items-center gap-3 min-h-[40px]">
                <input type="checkbox" checked={elegidos.includes(e.clave)} onChange={() => alternar(e.clave)}
                       className="w-5 h-5 accent-rosa-600 shrink-0" />
                <span className="text-[15px]">{e.titulo}</span>
              </label>
            ))}
          </div>
          {error && <Aviso>{error}</Aviso>}
          {guardado && <p className="text-[13px] text-estado-exito">✓ Guardado.</p>}
          <div className={`grid gap-2 ${activo ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {activo && <Boton variante="secundario" onClick={apagar} cargando={trabajando}>Apagar</Boton>}
            <Boton onClick={guardar} cargando={trabajando}>{activo ? 'Guardar' : 'Activar avisos'}</Boton>
          </div>
        </>
      )}
    </Tarjeta>
  )
}
