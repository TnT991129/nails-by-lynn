import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerDisponibilidad, obtenerDiasLaborables, obtenerDiasCerrados, reprogramarCita } from '../../lib/api'
import type { CitaDetalle } from '../../lib/tipos'
import { PasoFecha, PasoHora } from './Pasos'
import { Boton, Tarjeta, Aviso } from '../../componentes/ui'
import { IconoWhatsApp, IconoCheck } from '../../componentes/iconos'
import { fechaLarga, hora } from '../../lib/formato'
import { mensajeDeError, codigoDeError } from '../../lib/errores'

function enlaceAvisoCambio(c: CitaDetalle, anterior: string, nuevo: string): string | null {
  if (!c.negocio.whatsapp) return null
  const digitos = c.negocio.whatsapp.replace(/\D/g, '')
  const numero = digitos.length === 8 ? '53' + digitos : digitos
  const mensaje = `Hola Lynn! Cambié la fecha de mi cita 💅

👤 ${c.cliente.nombre}
🔖 Código: ${c.code}
❌ Antes: ${fechaLarga(anterior)} a las ${hora(anterior)}
✅ Ahora: ${fechaLarga(nuevo)} a las ${hora(nuevo)}`
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}

// La clienta elige otro día y turno para su cita desde /cita/{token}
export default function ReprogramarCita({ token, cita, onCerrar }: {
  token: string; cita: CitaDetalle; onCerrar: () => void
}) {
  const qc = useQueryClient()
  const [paso, setPaso] = useState<'fecha' | 'hora'>('fecha')
  const [fecha, setFecha] = useState<string | null>(null)
  const [inicio, setInicio] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<{ anterior: string; nuevo: string } | null>(null)

  const qDias = useQuery({ queryKey: ['dias-laborables'], queryFn: obtenerDiasLaborables })
  const qCerrados = useQuery({ queryKey: ['dias-cerrados'], queryFn: obtenerDiasCerrados })
  const qHoras = useQuery({
    queryKey: ['disponibilidad-reprogramar', token, fecha],
    queryFn: () => obtenerDisponibilidad(fecha!, cita.duracion_minutos, cita.margen_minutos),
    enabled: paso === 'hora' && !!fecha,
    staleTime: 0,
  })

  async function confirmar() {
    if (!inicio) return
    setGuardando(true); setError(null)
    try {
      await reprogramarCita(token, inicio)
      setHecho({ anterior: cita.inicio, nuevo: inicio })
      qc.invalidateQueries({ queryKey: ['cita', token] })
    } catch (e) {
      setError(mensajeDeError(e))
      const codigo = codigoDeError(e)
      if (codigo === 'HORARIO_YA_TOMADO' || codigo === 'HORARIO_NO_DISPONIBLE') {
        setInicio(null); qHoras.refetch()
      }
    } finally { setGuardando(false) }
  }

  if (hecho) {
    const enlace = enlaceAvisoCambio(cita, hecho.anterior, hecho.nuevo)
    return (
      <Tarjeta className="space-y-4 text-center animate-entrada">
        <div className="w-14 h-14 rounded-full bg-rosa-600 text-white flex items-center justify-center mx-auto shadow-boton">
          <IconoCheck tam={28} strokeWidth={2.6} />
        </div>
        <div>
          <h2 className="text-[24px] leading-tight">¡Cita cambiada!</h2>
          <p className="text-[15px] text-tinta-suave mt-2">
            Ahora es el <b>{fechaLarga(hecho.nuevo)}</b> a las <b>{hora(hecho.nuevo)}</b>.
          </p>
        </div>
        {enlace && (
          <a href={enlace} target="_blank" rel="noreferrer"
             className="w-full min-h-[56px] bg-[#25D366] text-white font-semibold text-[17px] rounded-full px-4
                        flex items-center justify-center gap-2 shadow-[0_10px_24px_-10px_rgba(37,211,102,.7)]
                        active:scale-[0.98] transition">
            <IconoWhatsApp tam={22} /> Avisar a Lynn del cambio
          </a>
        )}
        <Boton ancho variante="secundario" onClick={onCerrar}>Listo</Boton>
      </Tarjeta>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold tracking-[0.15em] uppercase text-rosa-700">Cambiar mi cita</span>
        <button onClick={onCerrar} className="text-tinta-suave min-h-[44px] px-2 text-[14px]">Cancelar</button>
      </div>

      {error && <Aviso>{error}</Aviso>}

      {paso === 'fecha' ? (
        <>
          <PasoFecha fecha={fecha} setFecha={f => { setFecha(f); setInicio(null) }} diasLaborables={qDias.data}
                     diasCerrados={qCerrados.data} />
          <Boton ancho disabled={!fecha} onClick={() => setPaso('hora')}>Ver turnos</Boton>
        </>
      ) : (
        <>
          <button onClick={() => { setPaso('fecha'); setInicio(null) }}
                  className="text-rosa-800 font-medium text-[14px] min-h-[44px]">← Cambiar de día</button>
          <PasoHora horas={qHoras.data ?? []} cargando={qHoras.isLoading}
            error={qHoras.isError ? mensajeDeError(qHoras.error) : null}
            inicio={inicio} onElegir={setInicio} expiraEn={null} />
          {inicio && (
            <Tarjeta className="space-y-3 animate-entrada">
              <div className="text-[14px] text-tinta-tenue">Tu cita pasará al</div>
              <div className="text-[18px] font-semibold">{fechaLarga(inicio)} · {hora(inicio)}</div>
              <Boton ancho cargando={guardando} onClick={confirmar}>Confirmar cambio</Boton>
            </Tarjeta>
          )}
        </>
      )}
    </div>
  )
}
