import { useQuery } from '@tanstack/react-query'
import { obtenerTurnos, obtenerDiasLaborables } from './api'
import { textoTurnos, textoDias } from './formato'

// Días de trabajo y horas de los turnos, leídos de la configuración de Lynn.
// Mientras cargan (o si fallan) los textos quedan vacíos y las pantallas usan un texto genérico.
export function useHorarioPublico() {
  const qTurnos = useQuery({ queryKey: ['turnos'], queryFn: obtenerTurnos, staleTime: 10 * 60_000 })
  const qDias = useQuery({ queryKey: ['dias-laborables'], queryFn: obtenerDiasLaborables, staleTime: 10 * 60_000 })
  const turnos = textoTurnos(qTurnos.data ?? [])
  const dias = textoDias(qDias.data ?? [])
  return {
    turnos,                                  // "10:00 AM y 1:00 PM"
    dias,                                    // "lunes a sábado"
    cantidad: qTurnos.data?.length ?? 0,     // número de turnos al día
  }
}
