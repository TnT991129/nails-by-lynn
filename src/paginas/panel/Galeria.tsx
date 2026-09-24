import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listarFotosPanel, subirImagen, crearFoto, actualizarFoto, eliminarFoto,
  catalogoServicios, type FotoPanel,
} from '../../lib/panel/api-panel'
import { Boton, Tarjeta, Aviso, Esqueleto, Etiqueta } from '../../componentes/ui'
import { mensajeDeError } from '../../lib/errores'

type Servicio = { id: string; name: string }

export default function GaleriaPanel() {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const qFotos = useQuery({ queryKey: ['fotos-panel'], queryFn: listarFotosPanel })
  const qServ = useQuery<Servicio[]>({ queryKey: ['cat-serv'], queryFn: catalogoServicios as () => Promise<Servicio[]> })

  const [archivo, setArchivo] = useState<File | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [servicioId, setServicioId] = useState<string>('')
  const [caption, setCaption] = useState('')
  const [tieneConsentimiento, setTieneConsentimiento] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function elegirArchivo(f: File | null) {
    setArchivo(f)
    if (previa) URL.revokeObjectURL(previa)
    setPrevia(f ? URL.createObjectURL(f) : null)
  }

  async function subir() {
    if (!archivo) { setError('Elige una foto primero.'); return }
    if (!tieneConsentimiento) {
      if (!confirm('No marcaste consentimiento. La foto se guardará como NO publicada. ¿Continuar?')) return
    }
    setSubiendo(true); setError(null)
    try {
      const { url } = await subirImagen(archivo)
      await crearFoto({
        image_url: url,
        service_id: servicioId || null,
        caption: caption.trim() || null,
        alt_text: null,
        has_consent: tieneConsentimiento,
        is_featured: false,
        // solo publicar si hay consentimiento
        is_published: tieneConsentimiento,
      })
      // Limpiar
      setArchivo(null)
      if (previa) URL.revokeObjectURL(previa)
      setPrevia(null); setCaption(''); setServicioId(''); setTieneConsentimiento(false)
      qc.invalidateQueries({ queryKey: ['fotos-panel'] })
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="p-5 space-y-5 pb-24">
      <button onClick={() => navegar(-1)} className="text-tinta-suave min-h-[44px]">← Volver</button>
      <h1 className="font-display text-[30px]">Galería</h1>

      {/* Subir foto */}
      <Tarjeta className="space-y-3">
        <div className="text-[14px] font-medium">Subir foto nueva</div>

        {!previa && (
          <label className="block w-full border-2 border-dashed border-rosa-300 rounded-sm
                            p-6 text-center cursor-pointer hover:bg-rosa-50 min-h-[100px]
                            flex flex-col items-center justify-center">
            <span className="text-[24px] mb-1">📷</span>
            <span className="text-[14px] text-tinta-suave">Tocar para elegir foto</span>
            <input type="file" accept="image/jpeg,image/png,image/webp"
              onChange={e => elegirArchivo(e.target.files?.[0] ?? null)}
              className="hidden" />
          </label>
        )}

        {previa && (
          <div className="space-y-2">
            <div className="aspect-square overflow-hidden rounded-sm bg-rosa-100 relative">
              <img src={previa} alt="" className="w-full h-full object-cover" />
              <button onClick={() => elegirArchivo(null)}
                className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/60 text-white text-[18px]">✕</button>
            </div>
          </div>
        )}

        {previa && (
          <>
            <label className="block">
              <span className="block text-[14px] text-tinta-suave mb-1.5">Servicio (opcional)</span>
              <select value={servicioId} onChange={e => setServicioId(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-sm border border-rosa-200 text-[16px] bg-white">
                <option value="">— Sin categoría —</option>
                {qServ.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="block text-[14px] text-tinta-suave mb-1.5">Título o comentario (opcional)</span>
              <input value={caption} onChange={e => setCaption(e.target.value)}
                placeholder="Ej: uñas en tono nude con detalle dorado"
                className="w-full min-h-[44px] px-3 rounded-sm border border-rosa-200 text-[16px]" />
            </label>

            <label className="flex items-start gap-2 p-3 rounded-sm border border-rosa-200 bg-rosa-50/50">
              <input type="checkbox" checked={tieneConsentimiento}
                onChange={e => setTieneConsentimiento(e.target.checked)}
                className="w-5 h-5 accent-rosa-600 mt-0.5" />
              <div>
                <div className="text-[14px] font-medium">La clienta autorizó publicar esta foto</div>
                <div className="text-[12px] text-tinta-tenue mt-0.5">
                  Sin este permiso, la foto NO aparecerá en el sitio público.
                </div>
              </div>
            </label>

            {error && <Aviso>{error}</Aviso>}
            <Boton ancho onClick={subir} cargando={subiendo}>Subir foto</Boton>
          </>
        )}
      </Tarjeta>

      {/* Galería actual */}
      <section>
        <Etiqueta>Fotos ({qFotos.data?.length ?? 0})</Etiqueta>

        {qFotos.isLoading && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {Array.from({length:6}).map((_,i) => <Esqueleto key={i} className="aspect-square" />)}
          </div>
        )}
        {qFotos.isError && <Aviso>{mensajeDeError(qFotos.error)}</Aviso>}
        {qFotos.data && qFotos.data.length === 0 && (
          <p className="text-[14px] text-tinta-tenue mt-3 text-center py-4">
            Aún no has subido fotos.
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 mt-3">
          {qFotos.data?.map(f => (
            <ThumbFoto key={f.id} foto={f} />
          ))}
        </div>
      </section>
    </div>
  )
}

function ThumbFoto({ foto }: { foto: FotoPanel }) {
  const qc = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [trabajando, setTrabajando] = useState(false)

  async function toggle(campo: 'is_featured' | 'is_published') {
    setTrabajando(true)
    try {
      await actualizarFoto(foto.id, { [campo]: !foto[campo] })
      qc.invalidateQueries({ queryKey: ['fotos-panel'] })
    } catch (e) { alert(mensajeDeError(e)) }
    finally { setTrabajando(false) }
  }

  async function borrar() {
    if (!confirm('¿Eliminar esta foto?')) return
    setTrabajando(true)
    try {
      await eliminarFoto(foto.id, foto.image_url)
      qc.invalidateQueries({ queryKey: ['fotos-panel'] })
      setAbierto(false)
    } catch (e) { alert(mensajeDeError(e)) }
    finally { setTrabajando(false) }
  }

  return (
    <>
      <button onClick={() => setAbierto(true)}
        className="aspect-square overflow-hidden rounded-sm bg-rosa-100 relative">
        <img src={foto.thumbnail_url ?? foto.image_url}
             alt={foto.alt_text ?? ''}
             loading="lazy"
             className="w-full h-full object-cover" />
        {!foto.is_published && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-[10px] tracking-wider">PRIVADA</span>
          </div>
        )}
        {foto.is_featured && (
          <span className="absolute top-1 right-1 text-[14px]">⭐</span>
        )}
      </button>

      {abierto && (
        <div onClick={() => setAbierto(false)}
             className="fixed inset-0 bg-black/85 z-50 flex items-end sm:items-center justify-center animate-entrada">
          <div onClick={e => e.stopPropagation()}
               className="bg-white w-full max-w-md rounded-t-lg sm:rounded-lg p-4 space-y-3">
            <img src={foto.image_url} alt=""
                 className="w-full aspect-square object-cover rounded-sm" />
            {foto.caption && <p className="text-[14px] text-tinta-suave">{foto.caption}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Boton variante="secundario" onClick={() => toggle('is_featured')} cargando={trabajando}>
                {foto.is_featured ? '⭐ Quitar destacada' : '⭐ Destacar'}
              </Boton>
              <Boton variante="secundario" onClick={() => toggle('is_published')} cargando={trabajando}>
                {foto.is_published ? 'Ocultar' : 'Publicar'}
              </Boton>
            </div>
            <Boton variante="peligro" ancho onClick={borrar} cargando={trabajando}>
              Eliminar foto
            </Boton>
          </div>
        </div>
      )}
    </>
  )
}
