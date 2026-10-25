import { useEffect, useState } from 'react'
import { Boton, Tarjeta, Aviso } from '../../componentes/ui'
import { estadoPush, activarPush, desactivarPush, vincularPush, type EstadoPush } from '../../lib/push'
import { useTextos, conNegritas } from '../../lib/textos'
import { mensajeDeError } from '../../lib/errores'

// Tarjeta de la página de la cita para recibir avisos en el móvil (cambios, cancelación, recordatorio)
export default function AvisosCita({ token }: { token: string }) {
  const t = useTextos()
  const [estado, setEstado] = useState<EstadoPush | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    estadoPush().then(e => {
      if (!vivo) return
      setEstado(e)
      if (e === 'activo') vincularPush(token)   // este móvil ya tenía avisos: también para esta cita
    }).catch(() => vivo && setEstado('no-disponible'))
    return () => { vivo = false }
  }, [token])

  async function activar() {
    setTrabajando(true); setError(null)
    try { await activarPush(token); setEstado('activo') }
    catch (e) {
      setError(mensajeDeError(e))
      setEstado(await estadoPush().catch(() => 'no-disponible' as const))
    }
    finally { setTrabajando(false) }
  }

  async function desactivar() {
    setTrabajando(true)
    try { await desactivarPush(); setEstado('inactivo') } finally { setTrabajando(false) }
  }

  if (!estado || estado === 'no-disponible') return null

  if (estado === 'activo') {
    return (
      <p className="flex items-center justify-center gap-2 text-[13px] text-tinta-tenue">
        {t('avisos.activos')}
        <button onClick={desactivar} disabled={trabajando} className="underline underline-offset-2 min-h-[44px] px-1">
          Desactivar
        </button>
      </p>
    )
  }

  return (
    <Tarjeta className="space-y-3">
      <div className="text-[16px] font-semibold">{t('avisos.titulo')}</div>
      {estado === 'instalar-ios' && <p className="text-[14px] text-tinta-suave">{conNegritas(t('avisos.ios'))}</p>}
      {estado === 'bloqueado' && <p className="text-[14px] text-tinta-suave">{t('avisos.bloqueados')}</p>}
      {estado === 'inactivo' && (
        <>
          <p className="text-[14px] text-tinta-suave">{t('avisos.texto')}</p>
          {error && <Aviso>{error}</Aviso>}
          <Boton ancho variante="secundario" cargando={trabajando} onClick={activar}>{t('avisos.boton')}</Boton>
        </>
      )}
    </Tarjeta>
  )
}
