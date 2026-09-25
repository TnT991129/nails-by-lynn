import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listarServiciosPanel, actualizarServicio, crearServicio, eliminarServicio,
  listarComplementos, actualizarComplemento, crearComplemento, eliminarComplemento,
  type ServicioEdit, type ComplementoEdit,
} from '../../lib/panel/api-panel'
import { Boton, Tarjeta, Esqueleto, Aviso } from '../../componentes/ui'
import { mensajeDeError } from '../../lib/errores'

export default function EditarServicios() {
  const navegar = useNavigate()
  const [pestaña, setPestaña] = useState<'servicios' | 'complementos'>('servicios')

  return (
    <div className="p-5 space-y-4">
      <button onClick={() => navegar(-1)} className="text-tinta-suave min-h-[44px]">← Volver</button>
      <h1 className="font-display text-[30px]">Servicios</h1>

      <div className="flex gap-1 bg-white rounded-sm border border-rosa-200 p-1 w-full">
        <button onClick={() => setPestaña('servicios')}
          className={`flex-1 px-3 py-2 rounded-sm text-[14px] min-h-[40px]
            ${pestaña === 'servicios' ? 'bg-rosa-600 text-white' : 'text-tinta-suave'}`}>
          Servicios
        </button>
        <button onClick={() => setPestaña('complementos')}
          className={`flex-1 px-3 py-2 rounded-sm text-[14px] min-h-[40px]
            ${pestaña === 'complementos' ? 'bg-rosa-600 text-white' : 'text-tinta-suave'}`}>
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

  if (q.isLoading) return <div className="space-y-2">
    {Array.from({length:3}).map((_,i) => <Esqueleto key={i} className="h-24" />)}
  </div>
  if (q.isError) return <Aviso>{mensajeDeError(q.error)}</Aviso>

  return (
    <div className="space-y-2">
      {creando ? (
        <FormularioNuevoServicio
          onCerrar={() => { setCreando(false); qc.invalidateQueries({ queryKey:['servicios-panel'] }) }} />
      ) : (
        <Boton ancho onClick={() => setCreando(true)}>+ Nuevo servicio</Boton>
      )}

      {q.data?.map(s => (
        <ItemServicio key={s.id} servicio={s}
          editando={editando === s.id}
          onEditar={() => setEditando(s.id)}
          onCerrar={() => { setEditando(null); qc.invalidateQueries({ queryKey:['servicios-panel'] }) }} />
      ))}
    </div>
  )
}

function FormularioNuevoServicio({ onCerrar }: { onCerrar: () => void }) {
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
      await crearServicio({
        name: nombre.trim(),
        description: descripcion.trim() || null,
        price: p, duration_minutes: d, buffer_after_minutes: b,
      })
      onCerrar()
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  return (
    <Tarjeta className="space-y-3 border-2 border-rosa-300">
      <div className="text-[14px] font-medium text-rosa-800">Nuevo servicio</div>
      <Campo label="Nombre" value={nombre} onChange={setNombre} />
      <label className="block">
        <span className="block text-[14px] text-tinta-suave mb-1.5">Descripción (opcional)</span>
        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2}
          className="w-full px-3 py-2 rounded-sm border border-rosa-200 text-[16px]" />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <Campo label="Precio" value={precio} onChange={setPrecio} inputMode="decimal" />
        <Campo label="Min." value={duracion} onChange={setDuracion} inputMode="numeric" />
        <Campo label="Buffer" value={buffer} onChange={setBuffer} inputMode="numeric" />
      </div>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex gap-2">
        <Boton variante="secundario" onClick={onCerrar} className="flex-1">Cancelar</Boton>
        <Boton onClick={guardar} cargando={guardando} className="flex-1">Crear</Boton>
      </div>
    </Tarjeta>
  )
}

function ItemServicio({ servicio, editando, onEditar, onCerrar }: {
  servicio: ServicioEdit; editando: boolean;
  onEditar: () => void; onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(servicio.name)
  const [descripcion, setDescripcion] = useState(servicio.description ?? '')
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
        price: p, duration_minutes: d, buffer_after_minutes: b,
        is_active: activo,
      })
      onCerrar()
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  async function borrar() {
    const msg = `¿Eliminar "${servicio.name}"?\n\nSi tiene citas asociadas, en su lugar quedará desactivado para preservar el historial.`
    if (!confirm(msg)) return
    setEliminando(true); setError(null)
    try {
      await eliminarServicio(servicio.id)
      onCerrar()
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setEliminando(false) }
  }

  if (!editando) return (
    <Tarjeta className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-medium truncate">{servicio.name}</span>
          {!servicio.is_active && (
            <span className="text-[11px] px-2 py-0.5 bg-tinta-tenue/20 rounded-sm">Inactivo</span>
          )}
        </div>
        <div className="text-[14px] text-tinta-tenue">
          {servicio.duration_minutes} min · {Number(servicio.price).toLocaleString('es-CU')} {servicio.currency}
        </div>
        {servicio.description && (
          <div className="text-[13px] text-tinta-suave mt-1 line-clamp-2">{servicio.description}</div>
        )}
      </div>
      <Boton variante="secundario" onClick={onEditar}>Editar</Boton>
    </Tarjeta>
  )

  return (
    <Tarjeta className="space-y-3">
      <Campo label="Nombre" value={nombre} onChange={setNombre} />
      <label className="block">
        <span className="block text-[14px] text-tinta-suave mb-1.5">Descripción</span>
        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2}
          className="w-full px-3 py-2 rounded-sm border border-rosa-200 text-[16px]" />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <Campo label="Precio" value={precio} onChange={setPrecio} inputMode="decimal" />
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
      <button onClick={borrar} disabled={eliminando}
        className="w-full text-[13px] text-estado-error min-h-[36px] disabled:opacity-50">
        {eliminando ? 'Eliminando…' : '🗑 Eliminar servicio'}
      </button>
    </Tarjeta>
  )
}

// ==================== COMPLEMENTOS ====================
function ListaComplementos() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['complementos-panel'], queryFn: listarComplementos })
  const [editando, setEditando] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

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

      {q.data?.map(c => (
        <ItemComplemento key={c.id} complemento={c}
          editando={editando === c.id}
          onEditar={() => setEditando(c.id)}
          onCerrar={() => { setEditando(null); qc.invalidateQueries({ queryKey:['complementos-panel'] }) }} />
      ))}
    </div>
  )
}

function FormularioNuevoComplemento({ onCerrar }: { onCerrar: () => void }) {
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [duracion, setDuracion] = useState('0')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setGuardando(true); setError(null)
    try {
      if (!nombre.trim()) throw new Error('Escribe el nombre')
      const p = Number(precio); const d = Number(duracion)
      if (isNaN(p) || p < 0) throw new Error('Precio inválido')
      if (isNaN(d) || d < 0) throw new Error('Duración inválida')
      await crearComplemento({
        name: nombre.trim(), extra_price: p, extra_minutes: d,
      })
      onCerrar()
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  return (
    <Tarjeta className="space-y-3 border-2 border-rosa-300">
      <div className="text-[14px] font-medium text-rosa-800">Nuevo complemento</div>
      <Campo label="Nombre" value={nombre} onChange={setNombre} />
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Precio extra" value={precio} onChange={setPrecio} inputMode="decimal" />
        <Campo label="Minutos extra" value={duracion} onChange={setDuracion} inputMode="numeric" />
      </div>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex gap-2">
        <Boton variante="secundario" onClick={onCerrar} className="flex-1">Cancelar</Boton>
        <Boton onClick={guardar} cargando={guardando} className="flex-1">Crear</Boton>
      </div>
    </Tarjeta>
  )
}

function ItemComplemento({ complemento, editando, onEditar, onCerrar }: {
  complemento: ComplementoEdit; editando: boolean;
  onEditar: () => void; onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(complemento.name)
  const [precio, setPrecio] = useState(String(complemento.extra_price))
  const [duracion, setDuracion] = useState(String(complemento.extra_minutes))
  const [activo, setActivo] = useState(complemento.is_active)
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setGuardando(true); setError(null)
    try {
      const p = Number(precio); const d = Number(duracion)
      if (isNaN(p) || p < 0) throw new Error('Precio inválido')
      if (isNaN(d) || d < 0) throw new Error('Duración inválida')
      await actualizarComplemento(complemento.id, {
        name: nombre.trim(), extra_price: p, extra_minutes: d, is_active: activo,
      })
      onCerrar()
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  async function borrar() {
    const msg = `¿Eliminar "${complemento.name}"?\n\nSi tiene citas asociadas, en su lugar quedará desactivado para preservar el historial.`
    if (!confirm(msg)) return
    setEliminando(true); setError(null)
    try {
      await eliminarComplemento(complemento.id)
      onCerrar()
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setEliminando(false) }
  }

  if (!editando) return (
    <Tarjeta className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-medium truncate">{complemento.name}</span>
          {!complemento.is_active && (
            <span className="text-[11px] px-2 py-0.5 bg-tinta-tenue/20 rounded-sm">Inactivo</span>
          )}
        </div>
        <div className="text-[14px] text-tinta-tenue">
          +{complemento.extra_minutes} min · +{Number(complemento.extra_price).toLocaleString('es-CU')} CUP
        </div>
      </div>
      <Boton variante="secundario" onClick={onEditar}>Editar</Boton>
    </Tarjeta>
  )

  return (
    <Tarjeta className="space-y-3">
      <Campo label="Nombre" value={nombre} onChange={setNombre} />
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Precio extra" value={precio} onChange={setPrecio} inputMode="decimal" />
        <Campo label="Minutos extra" value={duracion} onChange={setDuracion} inputMode="numeric" />
      </div>
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
      <button onClick={borrar} disabled={eliminando}
        className="w-full text-[13px] text-estado-error min-h-[36px] disabled:opacity-50">
        {eliminando ? 'Eliminando…' : '🗑 Eliminar complemento'}
      </button>
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
        className="w-full min-h-[44px] px-3 rounded-sm border border-rosa-200 text-[16px]" />
    </label>
  )
}
