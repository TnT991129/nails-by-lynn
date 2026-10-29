import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerTextosPanel, guardarTextosPanel } from '../../lib/panel/api-panel'
import { CLAVE_DISENO } from '../../lib/diseno'
import { TEXTOS, type ClaveTexto } from '../../lib/textos'
import { urlPublica } from '../../lib/panel/whatsapp'
import { Boton, Aviso, Esqueleto } from '../../componentes/ui'
import { mensajeDeError } from '../../lib/errores'
import { Volver } from './comunes'

const CLAVES = Object.keys(TEXTOS) as ClaveTexto[]
const GRUPOS = [...new Set(CLAVES.map(c => TEXTOS[c].grupo))]

const campo = 'w-full px-3 py-2 rounded-lg border border-rosa-200 text-[16px] bg-papel ' +
  'focus:outline-none focus:ring-4 focus:ring-rosa-100 focus:border-rosa-500 placeholder:text-tinta-tenue/70'

// Lynn cambia cualquier texto de la web de las clientas; vacío = el texto de siempre
export default function TextosWeb() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['textos-panel'], queryFn: obtenerTextosPanel })
  const [valores, setValores] = useState<Record<string, string> | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  if (q.data && !valores) setValores(q.data)

  const buscar = busqueda.trim().toLowerCase()
  const visibles = useMemo(() => CLAVES.filter(c => !buscar
    || TEXTOS[c].etiqueta.toLowerCase().includes(buscar)
    || TEXTOS[c].defecto.toLowerCase().includes(buscar)
    || (valores?.[c] ?? '').toLowerCase().includes(buscar)), [buscar, valores])

  function cambiar(clave: ClaveTexto, texto: string) {
    setValores(v => ({ ...(v ?? {}), [clave]: texto }))
    setGuardado(false)
  }

  async function guardar() {
    if (!valores) return
    // Solo se guarda lo que de verdad cambia respecto al texto de siempre
    const limpios: Record<string, string> = {}
    for (const c of CLAVES) {
      const t = (valores[c] ?? '').trim().slice(0, 1000)
      if (t && t !== TEXTOS[c].defecto) limpios[c] = t
    }
    // El diseño de la web va guardado junto a los textos (Diseño de la web): se conserva tal cual
    const diseno = q.data?.[CLAVE_DISENO]
    if (diseno) limpios[CLAVE_DISENO] = diseno
    setGuardando(true); setError(null); setGuardado(false)
    try {
      await guardarTextosPanel(limpios)
      setValores(limpios)
      qc.invalidateQueries({ queryKey: ['textos-panel'] })
      qc.invalidateQueries({ queryKey: ['textos'] })
      setGuardado(true)
    } catch (e) { setError(mensajeDeError(e)) }
    finally { setGuardando(false) }
  }

  const cambiados = valores ? CLAVES.filter(c => (valores[c] ?? '').trim()).length : 0

  return (
    <div className="p-5 space-y-4 pb-32">
      <Volver />
      <div>
        <h1 className="text-[30px] leading-tight">Textos de la web</h1>
        <p className="text-[14px] text-tinta-tenue mt-1">
          Cambia lo que leen las clientas. Si dejas un campo vacío, se usa el texto de siempre (el que ves en gris).
          Escribe <b>**así**</b> para poner algo en negrita.
        </p>
        <a href={urlPublica()} target="_blank" rel="noreferrer"
           className="inline-flex items-center min-h-[44px] text-[14px] text-rosa-800 underline underline-offset-2">
          Ver la web →
        </a>
      </div>

      {q.isLoading && <Esqueleto className="h-64" />}
      {q.isError && <Aviso>{mensajeDeError(q.error)}</Aviso>}

      {valores && (
        <>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} type="search"
            placeholder="Buscar un texto…" aria-label="Buscar un texto" className={`${campo} min-h-[44px]`} />

          {GRUPOS.map(grupo => {
            const claves = visibles.filter(c => TEXTOS[c].grupo === grupo)
            if (claves.length === 0) return null
            const propios = claves.filter(c => (valores[c] ?? '').trim()).length
            return (
              <details key={grupo} open={!!buscar}
                className="bg-papel rounded-xl border border-rosa-100/80 shadow-suave group">
                <summary className="min-h-[52px] px-4 flex items-center justify-between gap-2 cursor-pointer list-none">
                  <span className="text-[16px] font-semibold">{grupo}</span>
                  <span className="text-[12px] text-tinta-tenue">
                    {propios > 0 ? `${propios} cambiado${propios === 1 ? '' : 's'}` : `${claves.length} textos`}
                    <span className="ml-2 inline-block transition group-open:rotate-180" aria-hidden>▾</span>
                  </span>
                </summary>
                <div className="px-4 pb-4 space-y-4">
                  {claves.map(c => {
                    const d: { etiqueta: string; defecto: string; largo?: boolean; variables?: string } = TEXTOS[c]
                    const valor = valores[c] ?? ''
                    return (
                      <label key={c} className="block">
                        <span className="flex items-baseline justify-between gap-2 mb-1.5">
                          <span className="text-[14px] font-medium text-tinta-suave">{d.etiqueta}</span>
                          {valor.trim() && (
                            <button type="button" onClick={e => { e.preventDefault(); cambiar(c, '') }}
                              className="text-[12px] text-rosa-800 underline shrink-0">Usar el de siempre</button>
                          )}
                        </span>
                        {d.largo
                          ? <textarea value={valor} onChange={e => cambiar(c, e.target.value)} rows={3}
                              placeholder={d.defecto || 'Vacío: no se muestra nada'} className={campo} />
                          : <input value={valor} onChange={e => cambiar(c, e.target.value)}
                              placeholder={d.defecto || 'Vacío: no se muestra nada'} className={`${campo} min-h-[44px]`} />}
                        {d.variables && (
                          <span className="block text-[12px] text-tinta-tenue mt-1">
                            Puedes usar {d.variables}: se cambia solo por el dato real.
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </details>
            )
          })}

          {visibles.length === 0 && <p className="text-[14px] text-tinta-tenue text-center">No hay textos con esa búsqueda.</p>}

          {error && <Aviso>{error}</Aviso>}
          {guardado && <p className="text-[14px] text-estado-exito text-center">✓ Guardado. Las clientas ya lo ven.</p>}
          <div className="sticky bottom-20 z-10">
            <Boton ancho onClick={guardar} cargando={guardando}>
              Guardar textos{cambiados > 0 ? ` (${cambiados} cambiado${cambiados === 1 ? '' : 's'})` : ''}
            </Boton>
          </div>
        </>
      )}
    </div>
  )
}
