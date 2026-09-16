import { useCallback, useMemo, useState } from 'react'
import type { Servicio, Addon, ItemReserva, CitaCreada } from '../../lib/tipos'
import { crearCita, crearHold } from '../../lib/api'
import { tokenSesion, nuevoTokenSesion, idDispositivo, guardarToken } from '../../lib/almacenamiento'

export type Paso = 1 | 2 | 3 | 4 | 5

export type Datos = {
  nombre: string; telefono: string; email: string; instagram: string; nota: string
}

const DATOS_VACIOS: Datos = { nombre:'', telefono:'', email:'', instagram:'', nota:'' }

export function useReserva(servicios: Servicio[], addons: Addon[]) {
  const [paso, setPaso] = useState<Paso>(1)
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [addonsElegidos, setAddonsElegidos] = useState<string[]>([])
  const [fecha, setFecha] = useState<string | null>(null)
  const [inicio, setInicio] = useState<string | null>(null)
  const [expiraEn, setExpiraEn] = useState<string | null>(null)
  const [datos, setDatos] = useState<Datos>(DATOS_VACIOS)
  const [aceptaPoliticas, setAceptaPoliticas] = useState(false)

  const serviciosElegidos = useMemo(
    () => servicios.filter(s => seleccionados.includes(s.id)),
    [servicios, seleccionados],
  )

  const addonsAplicables = useMemo(
    () => addons.filter(a => a.service_id === null || seleccionados.includes(a.service_id)),
    [addons, seleccionados],
  )

  const addonsActivos = useMemo(
    () => addonsAplicables.filter(a => addonsElegidos.includes(a.id)),
    [addonsAplicables, addonsElegidos],
  )

  // La duracion y el precio se calculan aqui solo para MOSTRARLOS.
  // El servidor los recalcula desde la base de datos al confirmar.
  const duracionTotal = useMemo(
    () => serviciosElegidos.reduce((t, s) => t + s.duration_minutes, 0)
        + addonsActivos.reduce((t, a) => t + a.extra_minutes, 0),
    [serviciosElegidos, addonsActivos],
  )

  const precioTotal = useMemo(
    () => serviciosElegidos.reduce((t, s) => t + Number(s.price), 0)
        + addonsActivos.reduce((t, a) => t + Number(a.extra_price), 0),
    [serviciosElegidos, addonsActivos],
  )

  const bufferTotal = useMemo(
    () => serviciosElegidos.reduce((m, s) => Math.max(m, s.buffer_after_minutes), 0),
    [serviciosElegidos],
  )

  const items: ItemReserva[] = useMemo(
    () => serviciosElegidos.map(s => ({
      service_id: s.id,
      addons: addonsActivos
        .filter(a => a.service_id === null || a.service_id === s.id)
        .map(a => a.id),
    })),
    [serviciosElegidos, addonsActivos],
  )

  const alternarServicio = useCallback((id: string) => {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setInicio(null); setExpiraEn(null)
  }, [])

  const alternarAddon = useCallback((id: string) => {
    setAddonsElegidos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setInicio(null); setExpiraEn(null)
  }, [])

  const retener = useCallback(async (horaISO: string) => {
    const sesion = nuevoTokenSesion()
    const r = await crearHold(horaISO, duracionTotal, sesion, bufferTotal || undefined)
    setInicio(horaISO)
    setExpiraEn(r.expira_en)
    return r
  }, [duracionTotal, bufferTotal])

  const confirmar = useCallback(async (): Promise<CitaCreada> => {
    if (!inicio) throw new Error('SIN_HORA')
    const cita = await crearCita({
      sesion: tokenSesion(),
      inicio,
      items,
      nombre: datos.nombre.trim(),
      telefono: datos.telefono.trim(),
      email: datos.email.trim() || null,
      instagram: datos.instagram.trim() || null,
      nota: datos.nota.trim() || null,
      dispositivo: idDispositivo(),
    })
    guardarToken(cita.access_token)
    return cita
  }, [inicio, items, datos])

  const volverAHora = useCallback(() => { setInicio(null); setExpiraEn(null); setPaso(3) }, [])

  return {
    paso, setPaso,
    seleccionados, alternarServicio, serviciosElegidos,
    addonsAplicables, addonsElegidos, alternarAddon,
    fecha, setFecha, inicio, setInicio, expiraEn, setExpiraEn,
    datos, setDatos, aceptaPoliticas, setAceptaPoliticas,
    duracionTotal, precioTotal, bufferTotal, items,
    retener, confirmar, volverAHora,
  }
}
