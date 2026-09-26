import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listarServiciosPanel, actualizarServicio, crearServicio, eliminarServicio, cambiarFotoServicio,
  listarComplementos, actualizarComplemento, crearComplemento, eliminarComplemento,
  type ServicioEdit, type ComplementoEdit,
} from '../../lib/panel/api-panel'
import { Boton, Tarjeta, Esqueleto, Aviso } from '../../componentes/ui'
import { mensajeDeError } from '../../lib/errores'
import { Volver } from './comunes'

export default function EditarServicios() {
  const [pestaña, setPestaña] = useState<'servicios' | 'complementos'>('servicios')

  return (
    <div className="p-5 space-y-4">
      <Volver />
      <h1 className="text-[30px] leading-tight">Servicios</h1>

      <div className="flex gap-1 bg-rosa-50 rounded-full border border-rosa-100 p-1 w-full">
        <button onClick={() => setPestaña('servicios')}
          className={`flex-1 px-3 py-2 rounded-full text-[14px] min-h-[40px] font-medium transition
            ${pestaña === 'servicios' ? 'bg-white text-rosa-700 shadow-sm' : 'text-tinta-suave'}`}>
          Servicios
        </button>
        <button onClick={() => setPestaña('complementos')}
          className={`flex-1 px-3 py-2 rounded-full text-[14px] min-h-[40px] font-medium transition
            ${pestaña === 'complementos' ? 'bg-white text-rosa-700 shadow-sm' : 'text-tinta-suave'}`}>
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
        <div className="rounded-lg border border-estado-exito/30 bg-[#E6F4EF] text-estado-exito text-[14px] px-4 py-3 flex justify-between gap-2">
          <span>{aviso}</span>
          <button onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="shrink-0">✕</button>
        </div>
      )}

      {q.data?.map(s => (
        <ItemServicio key={s.id} servicio={s}
          editando={editando === s.id}
          onEditar={() => { setEditando(s.id); setAviso(null) }}
          onAviso={setAviso}
          onCerrar={() => { setEditando(null); qc.invalidateQueries({ queryKey:['servicios-panel'] }); qc.invalidateQueries({ queryKey:['servicios'] }) }} />
      ))}
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
        <Campo label="Precio" value={precio} onChange={setPrecio} inputMode="decimal" />
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

function ItemServicio({ servicio, editando, onEditar, onCerrar, onAviso }: {
  servicio: ServicioEdit; editando: boolean;
  onEditar: () => void; onCerrar: () => void; onAviso: (t: string) => void;
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
    <Tarjeta className="flex items-start justify-between gap-3">
      {servicio.cover_image_url ? (
        <img src={servicio.cover_image_url} alt="" loading="lazy" crossOrigin="anonymous"
             className="w-14 h-14 rounded-lg object-cover shrink-0 bg-rosa-50" />
      ) : (
        <span className="w-14 h-14 rounded-lg bg-rosa-50 border border-dashed border-rosa-200 shrink-0
                         flex items-center justify-center text-[11px] text-tinta-tenue text-center leading-tight">
          Sin foto
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-medium truncate">{servicio.name}</span>
          {!servicio.is_active && (
            <span className="text-[11px] px-2 py-0.5 bg-tinta-tenue/15 text-tinta-suave rounded-full">Oculto</span>
          )}
        </div>
        <div className="text-[14px] text-tinta-tenue">
          {servicio.duration_minutes} min · {Number(servicio.price).toLocaleString('es-CU')} {servicio.currency}
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
      <FotoServicio servicio={servicio} />
      <Campo label="Nombre" value={nombre} onChange={setNombre} />
      <label className="block">
        <span className="block text-[14px] text-tinta-suave mb-1.5">Descripción (la ven las clientas)</span>
        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2}
          placeholder="Ej: Uñas esculpidas, resistentes y con acabado natural."
          className="w-full px-3 py-2 rounded border border-rosa-200 text-[16px]" />
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
      <Boton variante="peligro" ancho onClick={borrar} cargando={eliminando}>Eliminar servicio</Boton>
    </Tarjeta>
  )
}

// Foto de portada del servicio: se guarda al momento, sin esperar a «Guardar»
function FotoServicio({ servicio }: { servicio: ServicioEdit }) {
  const qc = useQueryClient()
  const entrada = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState(servicio.cover_image_url)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cambiar(archivo: File | null) {
    setTrabajando(true); setError(null)
    try {
      setUrl(await cambiarFotoServicio({ ...servicio, cover_image_url: url }, archivo))
      qc.invalidateQueries({ queryKey: ['servicios-panel'] })
      qc.invalidateQueries({ queryKey: ['servicios'] })
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setTrabajando(false); if (entrada.current) entrada.current.value = '' }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {url ? (
          <img src={url} alt="" crossOrigin="anonymous" className="w-20 h-20 rounded-lg object-cover bg-rosa-50" />
        ) : (
          <span className="w-20 h-20 rounded-lg bg-rosa-50 border border-dashed border-rosa-200
                           flex items-center justify-center text-[12px] text-tinta-tenue">Sin foto</span>
        )}
        <div className="flex-1 space-y-1">
          <input ref={entrada} type="file" accept="image/*" className="hidden"
                 onChange={e => e.target.files?.[0] && cambiar(e.target.files[0])} />
          <Boton variante="secundario" cargando={trabajando} onClick={() => entrada.current?.click()}
                 className="w-full !min-h-[44px] !text-[14px]">
            {url ? 'Cambiar foto' : 'Subir foto'}
          </Boton>
          {url && !trabajando && (
            <button onClick={() => cambiar(null)} className="w-full text-[13px] text-estado-error min-h-[32px]">
              Quitar foto
            </button>
          )}
        </div>
      </div>
      <p className="text-[12px] text-tinta-tenue">
        Se muestra en la web al elegir el servicio. Usa una foto de un trabajo tuyo, bien iluminada.
      </p>
      {error && <Aviso>{error}</Aviso>}
    </div>
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
        <Boton variante="secundario" onClick={() => onCerrar()} className="flex-1">Cancelar</Boton>
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
    <Tarjeta className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-medium truncate">{complemento.name}</span>
          {!complemento.is_active && (
            <span className="text-[11px] px-2 py-0.5 bg-tinta-tenue/15 text-tinta-suave rounded-full">Oculto</span>
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
