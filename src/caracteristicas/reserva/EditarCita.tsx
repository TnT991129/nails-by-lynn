import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerServicios, obtenerAddons, editarCita } from '../../lib/api'
import type { CitaDetalle, ItemReserva } from '../../lib/tipos'
import { PasoServicio, PasoExtras } from './Pasos'
import { Boton, Tarjeta, Aviso, Esqueleto } from '../../componentes/ui'
import { IconoWhatsApp, IconoCheck } from '../../componentes/iconos'
import EnCup from '../../componentes/EnCup'
import { duracion, precioRango, numeroWhatsApp } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'

function enlaceAvisoEdicion(c: CitaDetalle, servicios: string[], nota: string): string | null {
  if (!c.negocio.whatsapp) return null
  const numero = numeroWhatsApp(c.negocio.whatsapp)
  const mensaje = `Hola Lynn! Cambié los servicios de mi cita 💅

👤 ${c.cliente.nombre}
🔖 Código: ${c.code}

Ahora quiero:
${servicios.map(s => `• ${s}`).join('\n')}${nota ? `\n\n📝 Nota: ${nota}` : ''}`
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}

// La clienta cambia servicios, complementos o la nota de su cita (la fecha y la hora se quedan igual)
export default function EditarCita({ token, cita, onCerrar }: {
  token: string; cita: CitaDetalle; onCerrar: () => void
}) {
  const qc = useQueryClient()
  const qServ = useQuery({ queryKey: ['servicios'], queryFn: obtenerServicios })
  const qAddons = useQuery({ queryKey: ['addons'], queryFn: obtenerAddons })
  const [elegidos, setElegidos] = useState<string[] | null>(null)
  const [extras, setExtras] = useState<string[] | null>(null)
  const [nota, setNota] = useState(cita.nota ?? '')
  const [paso, setPaso] = useState<'servicios' | 'extras'>('servicios')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string[] | null>(null)

  // Al cargar el catálogo se marcan los servicios y complementos que ya tenía (por nombre)
  if (qServ.data && qAddons.data && elegidos === null) {
    const nombres = cita.servicios.map(s => s.nombre)
    const complementos = cita.servicios.flatMap(s => (s.complementos ?? []).map(a => a.nombre))
    setElegidos(qServ.data.filter(s => nombres.includes(s.name)).map(s => s.id))
    setExtras(qAddons.data.filter(a => complementos.includes(a.name)).map(a => a.id))
  }

  const sel = elegidos ?? []
  const servicios = useMemo(() => (qServ.data ?? []).filter(s => sel.includes(s.id)), [qServ.data, sel])
  const aplicables = (qAddons.data ?? []).filter(a => a.service_id === null || sel.includes(a.service_id))
  const activos = aplicables.filter(a => (extras ?? []).includes(a.id))
  const minutos = servicios.reduce((t, s) => t + s.duration_minutes, 0) + activos.reduce((t, a) => t + a.extra_minutes, 0)
  const base = servicios.reduce((t, s) => t + Number(s.price), 0)
  const minimo = base + activos.reduce((t, a) => t + Number(a.extra_price), 0)
  const maximo = base + activos.reduce((t, a) => t + Number(a.extra_price_max ?? a.extra_price), 0)
  const pct = Number(cita.descuento_porcentaje ?? 0)
  const conDesc = (n: number) => n - Math.round(n * pct) / 100

  function alternar(lista: string[] | null, id: string) {
    const l = lista ?? []
    return l.includes(id) ? l.filter(x => x !== id) : [...l, id]
  }

  async function guardar() {
    if (servicios.length === 0) { setError('Elige al menos un servicio.'); return }
    setGuardando(true); setError(null)
    // Igual que al reservar: cada complemento una sola vez (los generales, con el primer servicio)
    const items: ItemReserva[] = servicios.map((s, i) => ({
      service_id: s.id,
      addons: activos.filter(a => a.service_id === s.id || (i === 0 && !servicios.some(x => x.id === a.service_id))).map(a => a.id),
    }))
    try {
      await editarCita(token, items, nota.trim() || null)
      setHecho([...servicios.map(s => s.name), ...activos.map(a => `+ ${a.name}`)])
      qc.invalidateQueries({ queryKey: ['cita', token] })
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  if (hecho) {
    const enlace = enlaceAvisoEdicion(cita, hecho, nota.trim())
    return (
      <Tarjeta className="space-y-4 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-estado-exito-fondo text-estado-exito flex items-center justify-center">
          <IconoCheck tam={24} />
        </div>
        <div>
          <div className="text-[18px] font-semibold">¡Cita actualizada!</div>
          <p className="text-[14px] text-tinta-suave mt-1">Avisa a Lynn para que sepa qué te vas a hacer.</p>
        </div>
        {enlace && (
          <a href={enlace} target="_blank" rel="noreferrer"
             className="w-full min-h-[52px] rounded-full bg-whatsapp text-white font-semibold text-[15px]
                        flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <IconoWhatsApp tam={20} /> Avisar a Lynn por WhatsApp
          </a>
        )}
        <button onClick={onCerrar} className="text-[14px] text-rosa-800 underline min-h-[44px]">Listo</button>
      </Tarjeta>
    )
  }

  if (qServ.isLoading || qAddons.isLoading || elegidos === null) return <Esqueleto className="h-64" />

  return (
    <div className="space-y-4">
      {paso === 'servicios' ? (
        <PasoServicio servicios={qServ.data ?? []} seleccionados={sel}
          alternar={id => setElegidos(l => alternar(l, id))} />
      ) : (
        <>
          <PasoExtras addons={aplicables} addonsElegidos={extras ?? []}
            alternarAddon={id => setExtras(l => alternar(l, id))} />
          <label className="block">
            <span className="block text-[14px] font-medium text-tinta-suave mb-1.5">Nota para Lynn (opcional)</span>
            <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} maxLength={500}
              className="w-full px-3 py-2 rounded-lg border border-rosa-200 text-[16px] bg-papel
                         focus:outline-none focus:ring-4 focus:ring-rosa-100 focus:border-rosa-500" />
          </label>
        </>
      )}

      <Tarjeta className="space-y-1">
        <div className="flex justify-between items-baseline">
          <span className="text-[14px] text-tinta-tenue">
            {servicios.length === 0 ? 'Elige al menos un servicio' : `Nuevo total · ${duracion(minutos)}`}
          </span>
          {servicios.length > 0 && (
            <span className="text-right font-display text-[20px] text-rosa-700">
              {precioRango(conDesc(minimo), maximo > minimo ? conDesc(maximo) : null)}
              <EnCup min={conDesc(minimo)} max={maximo > minimo ? conDesc(maximo) : null} />
            </span>
          )}
        </div>
        {pct > 0 && <p className="text-[12px] text-estado-exito">Incluye tu {pct}% de descuento 🎁</p>}
        {minutos > cita.duracion_minutos && (
          <p className="text-[12px] text-tinta-tenue">La cita durará más; si choca con la siguiente te avisaremos.</p>
        )}
      </Tarjeta>

      {error && <Aviso>{error}</Aviso>}

      <div className="flex gap-2">
        <Boton variante="secundario" className="flex-1"
          onClick={() => paso === 'extras' ? setPaso('servicios') : onCerrar()}>
          {paso === 'extras' ? 'Atrás' : 'Cancelar'}
        </Boton>
        {paso === 'servicios'
          ? <Boton className="flex-1" disabled={servicios.length === 0} onClick={() => setPaso('extras')}>Continuar</Boton>
          : <Boton className="flex-1" cargando={guardando} onClick={guardar}>Guardar cambios</Boton>}
      </div>
    </div>
  )
}
