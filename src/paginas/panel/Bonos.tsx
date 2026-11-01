import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listarBonos, crearBono, anularBono, type Bono } from '../../lib/panel/api-panel'
import { mensajeBono } from '../../lib/panel/whatsapp'
import { Boton, Tarjeta, Aviso, Esqueleto, Campo } from '../../componentes/ui'
import { IconoWhatsApp } from '../../componentes/iconos'
import { importe, leerNumero, fechaLarga, fechaISO } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'
import { Volver } from './comunes'

// Bonos regalo: Lynn los vende y se canjean en «Cobrar» de cualquier cita, en una o varias veces
export default function Bonos() {
  const q = useQuery({ queryKey: ['bonos'], queryFn: listarBonos })
  const [creando, setCreando] = useState(false)

  if (q.isLoading) return <div className="p-5"><Esqueleto className="h-64" /></div>
  if (q.isError) return <div className="p-5"><Aviso>{mensajeDeError(q.error)}</Aviso></div>

  const bonos = q.data
  const vivos = (bonos ?? []).filter(b => !b.is_cancelled)
  const vendido = vivos.reduce((t, b) => t + b.amount, 0)
  const pendiente = vivos.reduce((t, b) => t + b.saldo, 0)

  return (
    <div className="p-5 space-y-4">
      <Volver />
      <div>
        <h1 className="text-[30px] leading-tight">Bonos regalo</h1>
        <p className="text-[14px] text-tinta-tenue mt-1">
          Crea un bono, mándalo por WhatsApp a quien lo compra y, cuando venga la persona regalada, cóbralo en
          «Cobrar» → <b>Bono regalo</b>. Se puede gastar en varias citas hasta acabar el saldo.
        </p>
      </div>

      {bonos === null && (
        <Aviso tipo="aviso">Falta ejecutar en Supabase el SQL <b>recomendaciones_y_bonos.sql</b> para poder crear bonos.</Aviso>
      )}

      {bonos && (
        <>
          {vivos.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <Tarjeta className="text-center py-3">
                <div className="text-[11px] uppercase tracking-wider text-tinta-tenue">Vendidos</div>
                <div className="font-display text-[22px] mt-1">{importe(vendido)}</div>
              </Tarjeta>
              <Tarjeta className="text-center py-3">
                <div className="text-[11px] uppercase tracking-wider text-tinta-tenue">Por gastar</div>
                <div className="font-display text-[22px] mt-1">{importe(pendiente)}</div>
              </Tarjeta>
            </div>
          )}

          {creando ? <NuevoBono onCerrar={() => setCreando(false)} />
            : <Boton ancho onClick={() => setCreando(true)}>🎁 Nuevo bono</Boton>}

          {bonos.length === 0 && !creando && (
            <p className="text-[14px] text-tinta-tenue px-1">Todavía no has creado ningún bono.</p>
          )}
          <div className="space-y-3">
            {bonos.map(b => <TarjetaBono key={b.id} b={b} />)}
          </div>
          <p className="text-[13px] text-tinta-tenue px-1">
            En Estadísticas, lo que se paga con un bono cuenta como ingreso de la cita en que se usa.
          </p>
        </>
      )}
    </div>
  )
}

function compartir(b: Bono) {
  window.open(`https://wa.me/?text=${encodeURIComponent(mensajeBono(b))}`, '_blank', 'noopener,noreferrer')
}

function NuevoBono({ onCerrar }: { onCerrar: () => void }) {
  const qc = useQueryClient()
  const [d, setD] = useState({ monto: '', para: '', de: '', nota: '', caduca: '' })
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value })

  async function guardar() {
    const monto = leerNumero(d.monto)
    if (!(monto > 0)) { setError('Escribe el valor del bono en dólares.'); return }
    setTrabajando(true); setError(null)
    try {
      await crearBono({
        amount: monto, recipient_name: d.para.trim() || null, buyer_name: d.de.trim() || null,
        note: d.nota.trim() || null, expires_on: d.caduca || null,
      })
      await qc.invalidateQueries({ queryKey: ['bonos'] })
      onCerrar()
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setTrabajando(false) }
  }

  return (
    <Tarjeta className="space-y-3 border border-rosa-200 animate-entrada">
      <div className="text-[16px] font-semibold">Nuevo bono</div>
      <Campo etiqueta="Valor (USD)" value={d.monto} onChange={set('monto')} inputMode="decimal" placeholder="20" />
      <Campo etiqueta="Para (opcional)" value={d.para} onChange={set('para')} placeholder="Nombre de la persona regalada" />
      <Campo etiqueta="De parte de (opcional)" value={d.de} onChange={set('de')} placeholder="Quien lo compra" />
      <Campo etiqueta="Dedicatoria (opcional)" value={d.nota} onChange={set('nota')} placeholder="¡Feliz cumpleaños!" />
      <Campo etiqueta="Válido hasta (opcional)" value={d.caduca} onChange={set('caduca')} type="date" min={fechaISO(new Date())} />
      {error && <Aviso>{error}</Aviso>}
      <div className="flex gap-2">
        <Boton variante="secundario" onClick={onCerrar} className="flex-1">Cancelar</Boton>
        <Boton onClick={guardar} cargando={trabajando} className="flex-1">Crear bono</Boton>
      </div>
      <p className="text-[12px] text-tinta-tenue">Saldrá el primero de la lista, con su botón para mandarlo por WhatsApp.</p>
    </Tarjeta>
  )
}

function TarjetaBono({ b }: { b: Bono }) {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const caducado = !!b.expires_on && b.expires_on < fechaISO(new Date())
  const estado = b.is_cancelled ? 'Anulado' : b.saldo <= 0 ? 'Gastado' : caducado ? 'Caducado' : null

  async function anular(v: boolean) {
    if (v && !confirm(`¿Anular el bono ${b.code}? Ya no se podrá usar.`)) return
    setError(null)
    try { await anularBono(b.id, v); qc.invalidateQueries({ queryKey: ['bonos'] }) }
    catch (e) { setError(mensajeDeError(e)) }
  }

  return (
    <Tarjeta className={`space-y-2 ${estado ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[17px] font-semibold tracking-wider">{b.code}</div>
          <div className="text-[13px] text-tinta-tenue truncate">
            {[b.recipient_name && `Para ${b.recipient_name}`, b.buyer_name && `de ${b.buyer_name}`].filter(Boolean).join(' · ') || 'Sin nombre'}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-[20px]">{importe(b.saldo)}</div>
          <div className="text-[12px] text-tinta-tenue">de {importe(b.amount)}</div>
        </div>
      </div>
      {estado && <div className="text-[13px] font-semibold text-tinta-suave">{estado}</div>}
      {b.expires_on && !estado && <div className="text-[12px] text-tinta-tenue">Válido hasta el {fechaLarga(`${b.expires_on}T16:00:00Z`)}</div>}
      {b.usos.length > 0 && (
        <ul className="text-[13px] text-tinta-suave space-y-0.5">
          {b.usos.map((u, i) => (
            <li key={i}>
              <Link to={`/panel/cita/${u.cita}`} className="underline underline-offset-2">{fechaLarga(u.fecha)}</Link>: {importe(u.monto)}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 pt-1">
        {!b.is_cancelled && b.saldo > 0 && (
          <button onClick={() => compartir(b)}
            className="flex-1 min-h-[40px] rounded-full bg-whatsapp text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5">
            <IconoWhatsApp tam={15} /> Enviar
          </button>
        )}
        <button onClick={() => anular(!b.is_cancelled)}
          className="min-h-[40px] px-4 rounded-full border border-rosa-200 text-[13px] text-tinta-suave">
          {b.is_cancelled ? 'Reactivar' : 'Anular'}
        </button>
      </div>
      {error && <Aviso>{error}</Aviso>}
    </Tarjeta>
  )
}
