import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listarServiciosPanel, actualizarServicio, crearServicio, eliminarServicio,
  listarComplementos, actualizarComplemento, crearComplemento, eliminarComplemento, guardarOrden,
  type ServicioEdit, type ComplementoEdit,
} from '../../lib/panel/api-panel'
import { Boton, Tarjeta, Esqueleto, Aviso } from '../../componentes/ui'
import { mensajeDeError } from '../../lib/errores'
import { precioRango, dinero } from '../../lib/formato'
import { Volver } from './comunes'
import ListaOrdenable from './ListaOrdenable'
import TasaDolar from './TasaDolar'

export default function EditarServicios() {
  const [pestaña, setPestaña] = useState<'servicios' | 'complementos'>('servicios')

  return (
    <div className="p-5 space-y-4">
      <Volver />
      <h1 className="text-[30px] leading-tight">Servicios</h1>
      <TasaDolar />

      <div className="flex gap-1 bg-rosa-50 rounded-full border border-rosa-100 p-1 w-full">
        <button onClick={() => setPestaña('servicios')}
          className={`flex-1 px-3 py-2 rounded-full text-[14px] min-h-[40px] font-medium transition
            ${pestaña === 'servicios' ? 'bg-papel text-rosa-700 shadow-sm' : 'text-tinta-suave'}`}>
          Servicios
        </button>
        <button onClick={() => setPestaña('complementos')}
          className={`flex-1 px-3 py-2 rounded-full text-[14px] min-h-[40px] font-medium transition
            ${pestaña === 'complementos' ? 'bg-papel text-rosa-700 shadow-sm' : 'text-tinta-suave'}`}>
          Complementos
        </button>
      </div>

      {pestaña === 'servicios' ? <ListaServicios /> : <ListaComplementos />}
    </div>
  )
}

// ==================== SERVICIOS ====================
function ListaServicios() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['servicios-panel'], queryFn: listarServiciosPanel })
  const [editando, setEditando] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  // Nuevo orden: se ve al momento y se guarda por detrás; la web lo muestra igual
  async function reordenar(nuevos: ServicioEdit[]) {
    qc.setQueryData(['servicios-panel'], nuevos.map((s, i) => ({ ...s, sort_order: (i + 1) * 10 })))
    try {
      await guardarOrden('services', nuevos)
      qc.invalidateQueries({ queryKey: ['servicios'] })
    } catch (e) {
      setAviso(`No se pudo guardar el orden: ${mensajeDeError(e)}`)
      qc.invalidateQueries({ queryKey: ['servicios-panel'] })
    }
  }

  if (q.isLoading) return <div className="space-y-2">
    {Array.from({length:3}).map((_,i) => <Esqueleto key={i} className="h-24" />)}
  </div>
  if (q.isError) return <Aviso>{mensajeDeError(q.error)}</Aviso>

  return (
    <div className="space-y-2">
      {creando ? (
        <FormularioNuevoServicio
          onCerrar={nuevoId => {
            setCreando(false)
            qc.invalidateQueries({ queryKey:['servicios-panel'] })
            // Se abre en edición para poder añadirle la foto en el momento
            if (nuevoId) { setEditando(nuevoId); setAviso('Servicio creado. Añádele una foto si quieres.') }
          }} />
      ) : (
        <Boton ancho onClick={() => { setCreando(true); setAviso(null) }}>+ Nuevo servicio</Boton>
      )}

      {aviso && (
        <div className="rounded-lg border border-estado-exito/30 bg-estado-exito-fondo text-estado-exito text-[14px] px-4 py-3 flex justify-between gap-2">
          <span>{aviso}</span>
          <button onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="shrink-0">✕</button>
        </div>
      )}

      {(q.data?.length ?? 0) > 1 && (
        <p className="text-[13px] text-tinta-tenue px-1">
          Arrastra desde ⋮⋮ para cambiar el orden en que las clientas ven los servicios.
        </p>
      )}

      <ListaOrdenable items={q.data ?? []} onCambio={reordenar} deshabilitado={!!editando || creando} flechas={false}>
        {(s, asa) => (
          <ItemServicio servicio={s} asa={asa}
            editando={editando === s.id}
            onEditar={() => { setEditando(s.id); setAviso(null) }}
            onAviso={setAviso}
            onCerrar={() => { setEditando(null); qc.invalidateQueries({ queryKey:['servicios-panel'] }); qc.invalidateQueries({ queryKey:['servicios'] }) }} />
        )}
      </ListaOrdenable>
    </div>
  )
}

function FormularioNuevoServicio({ onCerrar }: { onCerrar: (nuevoId?: string) => void }) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [precio, setPrecio] = useState('')
  const [duracion, setDuracion] = useState('60')
  const [buffer, setBuffer] = useState('0')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setGuardando(true); setError(null)
    try {
      if (!nombre.trim()) throw new Error('Escribe el nombre')
      const p = Number(precio); const d = Number(duracion); const b = Number(buffer)
      if (isNaN(p) || p < 0) throw new Error('Precio inválido')
      if (isNaN(d) || d < 15) throw new Error('Duración mínima 15 minutos')
      if (isNaN(b) || b < 0) throw new Error('Buffer inválido')
      const creado = await crearServicio({
        name: nombre.trim(),
        description: descripcion.trim() || null,
        short_description: descripcion.trim() || null,
        price: p, duration_minutes: d, buffer_after_minutes: b,
      }) as { id?: string } | null
      onCerrar(creado?.id)
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  return (
    <Tarjeta className="space-y-3 border-2 border-rosa-300">
      <div className="text-[14px] font-medium text-rosa-800">Nuevo servicio</div>
      <Campo label="Nombre" value={nombre} onChange={setNombre} />
      <label className="block">
        <span className="block text-[14px] text-tinta-suave mb-1.5">Descripción (la ven las clientas)</span>
        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2}
          className="w-full px-3 py-2 rounded border border-rosa-200 text-[16px]" />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <Campo label="Precio (USD)" value={precio} onChange={setPrecio} inputMode="decimal" />
        <Campo label="Min." value={duracion} onChange={setDuracion} inputMode="numeric" />
        <Campo label="Buffer" value={buffer} onChange={setBuffer} inputMode="numeric" />
      </div>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex gap-2">
        <Boton variante="secundario" onClick={() => onCerrar()} className="flex-1">Cancelar</Boton>
        <Boton onClick={guardar} cargando={guardando} className="flex-1">Crear</Boton>
      </div>
    </Tarjeta>
  )
}

function ItemServicio({ servicio, editando, onEditar, onCerrar, onAviso, asa }: {
  servicio: ServicioEdit; editando: boolean;
  onEditar: () => void; onCerrar: () => void; onAviso: (t: string) => void; asa?: ReactNode;
}) {
  const [nombre, setNombre] = useState(servicio.name)
  // La web muestra short_description; si estaba vacía o de relleno, se aprovecha lo escrito en description
  const [descripcion, setDescripcion] = useState(
    (servicio.short_description && servicio.short_description !== 'Por definir' ? servicio.short_description : null)
      ?? servicio.description ?? '')
  const [precio, setPrecio] = useState(String(servicio.price))
  const [duracion, setDuracion] = useState(String(servicio.duration_minutes))
  const [buffer, setBuffer] = useState(String(servicio.buffer_after_minutes))
  const [activo, setActivo] = useState(servicio.is_active)
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setGuardando(true); setError(null)
    try {
      const p = Number(precio); const d = Number(duracion); const b = Number(buffer)
      if (isNaN(p) || p < 0) throw new Error('Precio inválido')
      if (isNaN(d) || d < 15) throw new Error('Duración mínima 15 minutos')
      if (isNaN(b) || b < 0) throw new Error('Buffer inválido')
      await actualizarServicio(servicio.id, {
        name: nombre.trim(),
        description: descripcion.trim() || null,
        short_description: descripcion.trim() || null,
        price: p, duration_minutes: d, buffer_after_minutes: b,
        is_active: activo,
      })
      onCerrar()
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  async function borrar() {
    const msg = `¿Eliminar "${servicio.name}"?\n\nSi tiene citas en el historial, en su lugar se desactivará (las clientas dejan de verlo y el historial se conserva).`
    if (!confirm(msg)) return
    setEliminando(true); setError(null)
    try {
      const r = await eliminarServicio(servicio.id) as { deleted?: boolean }
      onAviso(r?.deleted
        ? `«${servicio.name}» eliminado.`
        : `«${servicio.name}» tiene citas en el historial: quedó desactivado y las clientas ya no lo ven.`)
      onCerrar()
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setEliminando(false) }
  }

  async function reactivar() {
    try {
      await actualizarServicio(servicio.id, { is_active: true })
      onAviso(`«${servicio.name}» vuelve a estar visible para las clientas.`)
      onCerrar()
    } catch (e) { setError(mensajeDeError(e)) }
  }

  if (!editando) return (
    <Tarjeta className="flex items-center justify-between gap-3 !pl-3">
      {asa}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-medium truncate">{servicio.name}</span>
          {!servicio.is_active && (
            <span className="text-[11px] px-2 py-0.5 bg-tinta-tenue/15 text-tinta-suave rounded-full">Oculto</span>
          )}
        </div>
        <div className="text-[14px] text-tinta-tenue">
          {servicio.duration_minutes} min · {dinero(Number(servicio.price))}
        </div>
        {(servicio.short_description ?? servicio.description) && (
          <div className="text-[13px] text-tinta-suave mt-1 line-clamp-2">
            {servicio.short_description ?? servicio.description}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        <Boton variante="secundario" onClick={onEditar} className="!min-h-[40px] !px-4 !text-[14px]">Editar</Boton>
        {!servicio.is_active && (
          <button onClick={reactivar} className="text-[13px] text-rosa-800 font-semibold min-h-[32px]">Reactivar</button>
        )}
      </div>
    </Tarjeta>
  )

  return (
    <Tarjeta className="space-y-3">
      <Campo label="Nombre" value={nombre} onChange={setNombre} />
      <label className="block">
        <span className="block text-[14px] text-tinta-suave mb-1.5">Descripción (la ven las clientas)</span>
        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2}
          placeholder="Ej: Uñas esculpidas, resistentes y con acabado natural."
          className="w-full px-3 py-2 rounded border border-rosa-200 text-[16px]" />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <Campo label="Precio (USD)" value={precio} onChange={setPrecio} inputMode="decimal" />
        <Campo label="Min." value={duracion} onChange={setDuracion} inputMode="numeric" />
        <Campo label="Buffer" value={buffer} onChange={setBuffer} inputMode="numeric" />
      </div>
      <label className="flex items-center gap-2 min-h-[44px]">
        <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)}
          className="w-5 h-5 accent-rosa-600" />
        <span className="text-[14px]">Activo (visible para reservar)</span>
      </label>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex gap-2">
        <Boton variante="secundario" onClick={onCerrar} className="flex-1">Cancelar</Boton>
        <Boton onClick={guardar} cargando={guardando} className="flex-1">Guardar</Boton>
      </div>
      <Boton variante="peligro" ancho onClick={borrar} cargando={eliminando}>Eliminar servicio</Boton>
    </Tarjeta>
  )
}

// ==================== COMPLEMENTOS ====================
function ListaComplementos() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['complementos-panel'], queryFn: listarComplementos })
  const [editando, setEditando] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reordenar(nuevos: ComplementoEdit[]) {
    qc.setQueryData(['complementos-panel'], nuevos.map((c, i) => ({ ...c, sort_order: (i + 1) * 10 })))
    try {
      setError(null)
      await guardarOrden('service_addons', nuevos)
      qc.invalidateQueries({ queryKey: ['addons'] })
    } catch (e) {
      setError(`No se pudo guardar el orden: ${mensajeDeError(e)}`)
      qc.invalidateQueries({ queryKey: ['complementos-panel'] })
    }
  }

  if (q.isLoading) return <div className="space-y-2">
    {Array.from({length:2}).map((_,i) => <Esqueleto key={i} className="h-20" />)}
  </div>
  if (q.isError) return <Aviso>{mensajeDeError(q.error)}</Aviso>

  return (
    <div className="space-y-2">
      {creando ? (
        <FormularioNuevoComplemento
          onCerrar={() => { setCreando(false); qc.invalidateQueries({ queryKey:['complementos-panel'] }) }} />
      ) : (
        <Boton ancho onClick={() => setCreando(true)}>+ Nuevo complemento</Boton>
      )}

      {error && <Aviso>{error}</Aviso>}
      {(q.data?.length ?? 0) > 1 && (
        <p className="text-[13px] text-tinta-tenue px-1">
          Arrastra desde ⋮⋮ para cambiar el orden en el paso «¿Necesitas algo más?».
        </p>
      )}

      <ListaOrdenable items={q.data ?? []} onCambio={reordenar} deshabilitado={!!editando || creando} flechas={false}>
        {(c, asa) => (
          <ItemComplemento complemento={c} asa={asa}
            editando={editando === c.id}
            onEditar={() => setEditando(c.id)}
            onCerrar={() => { setEditando(null); qc.invalidateQueries({ queryKey:['complementos-panel'] }); qc.invalidateQueries({ queryKey:['addons'] }) }} />
        )}
      </ListaOrdenable>
    </div>
  )
}

function FormularioNuevoComplemento({ onCerrar }: { onCerrar: () => void }) {
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [precioMax, setPrecioMax] = useState('')
  const [duracion, setDuracion] = useState('0')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setGuardando(true); setError(null)
    try {
      if (!nombre.trim()) throw new Error('Escribe el nombre')
      const p = Number(precio); const d = Number(duracion)
      const max = leerMaximo(precioMax, p)
      if (isNaN(d) || d < 0) throw new Error('Duración inválida')
      await crearComplemento({
        name: nombre.trim(), extra_price: p, extra_price_max: max, extra_minutes: d,
      })
      onCerrar()
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  return (
    <Tarjeta className="space-y-3 border-2 border-rosa-300">
      <div className="text-[14px] font-medium text-rosa-800">Nuevo complemento</div>
      <Campo label="Nombre" value={nombre} onChange={setNombre} />
      <CamposPrecio desde={precio} hasta={precioMax} setDesde={setPrecio} setHasta={setPrecioMax}
                    minutos={duracion} setMinutos={setDuracion} />
      {error && <Aviso>{error}</Aviso>}
      <div className="flex gap-2">
        <Boton variante="secundario" onClick={() => onCerrar()} className="flex-1">Cancelar</Boton>
        <Boton onClick={guardar} cargando={guardando} className="flex-1">Crear</Boton>
      </div>
    </Tarjeta>
  )
}

function ItemComplemento({ complemento, editando, onEditar, onCerrar, asa }: {
  complemento: ComplementoEdit; editando: boolean;
  onEditar: () => void; onCerrar: () => void; asa?: ReactNode;
}) {
  const [nombre, setNombre] = useState(complemento.name)
  const [precio, setPrecio] = useState(String(complemento.extra_price))
  const [precioMax, setPrecioMax] = useState(complemento.extra_price_max != null ? String(complemento.extra_price_max) : '')
  const [duracion, setDuracion] = useState(String(complemento.extra_minutes))
  const [activo, setActivo] = useState(complemento.is_active)
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setGuardando(true); setError(null)
    try {
      const p = Number(precio); const d = Number(duracion)
      const max = leerMaximo(precioMax, p)
      if (isNaN(d) || d < 0) throw new Error('Duración inválida')
      await actualizarComplemento(complemento.id, {
        name: nombre.trim(), extra_price: p, extra_minutes: d, is_active: activo,
        // Solo se envía si hay rango o si antes lo tenía (para poder quitarlo)
        ...(max !== null || complemento.extra_price_max != null ? { extra_price_max: max } : {}),
      })
      onCerrar()
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  async function borrar() {
    const msg = `¿Eliminar "${complemento.name}"?\n\nSi se usó en alguna cita, en su lugar se desactivará (las clientas dejan de verlo y el historial se conserva).`
    if (!confirm(msg)) return
    setEliminando(true); setError(null)
    try {
      const r = await eliminarComplemento(complemento.id) as { deleted?: boolean }
      if (!r?.deleted) alert(`«${complemento.name}» se usó en citas anteriores: quedó desactivado y las clientas ya no lo ven.`)
      onCerrar()
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setEliminando(false) }
  }

  if (!editando) return (
    <Tarjeta className="flex items-center justify-between gap-3 !pl-3">
      {asa}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-medium truncate">{complemento.name}</span>
          {!complemento.is_active && (
            <span className="text-[11px] px-2 py-0.5 bg-tinta-tenue/15 text-tinta-suave rounded-full">Oculto</span>
          )}
        </div>
        <div className="text-[14px] text-tinta-tenue">
          +{complemento.extra_minutes} min · +{precioRango(Number(complemento.extra_price), complemento.extra_price_max)}
        </div>
      </div>
      <Boton variante="secundario" onClick={onEditar}>Editar</Boton>
    </Tarjeta>
  )

  return (
    <Tarjeta className="space-y-3">
      <Campo label="Nombre" value={nombre} onChange={setNombre} />
      <CamposPrecio desde={precio} hasta={precioMax} setDesde={setPrecio} setHasta={setPrecioMax}
                    minutos={duracion} setMinutos={setDuracion} />
      <label className="flex items-center gap-2 min-h-[44px]">
        <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)}
          className="w-5 h-5 accent-rosa-600" />
        <span className="text-[14px]">Activo</span>
      </label>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex gap-2">
        <Boton variante="secundario" onClick={onCerrar} className="flex-1">Cancelar</Boton>
        <Boton onClick={guardar} cargando={guardando} className="flex-1">Guardar</Boton>
      </div>
      <Boton variante="peligro" ancho onClick={borrar} cargando={eliminando}>Eliminar complemento</Boton>
    </Tarjeta>
  )
}

// ==================== CAMPO ====================
function Campo({ label, value, onChange, inputMode }: {
  label: string; value: string; onChange: (v: string) => void;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel';
}) {
  return (
    <label className="block">
      <span className="block text-[12px] text-tinta-suave mb-1">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} inputMode={inputMode ?? 'text'}
        className="w-full min-h-[44px] px-3 rounded border border-rosa-200 text-[16px]" />
    </label>
  )
}

// Precio del complemento: fijo, o rango "desde – hasta" (p. ej. 2 – 4)
function CamposPrecio({ desde, hasta, setDesde, setHasta, minutos, setMinutos }: {
  desde: string; hasta: string; setDesde: (v: string) => void; setHasta: (v: string) => void
  minutos: string; setMinutos: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-3 gap-2">
        <Campo label="Desde (USD)" value={desde} onChange={setDesde} inputMode="decimal" />
        <Campo label="Hasta (opcional)" value={hasta} onChange={setHasta} inputMode="decimal" />
        <Campo label="Minutos extra" value={minutos} onChange={setMinutos} inputMode="numeric" />
      </div>
      <p className="text-[12px] text-tinta-tenue">
        Deja «Hasta» vacío si el precio es fijo. Con rango, la clienta verá por ejemplo «+2–4» y al reservar se suma el precio «desde».
      </p>
    </div>
  )
}

// "Hasta" vacío = sin rango; si se escribe, tiene que ser mayor o igual que "desde"
function leerMaximo(texto: string, desde: number): number | null {
  if (isNaN(desde) || desde < 0) throw new Error('Precio inválido')
  if (!texto.trim()) return null
  const max = Number(texto.replace(',', '.'))
  if (isNaN(max) || max < desde) throw new Error('El precio «hasta» tiene que ser mayor o igual que «desde».')
  return max === desde ? null : max
}
