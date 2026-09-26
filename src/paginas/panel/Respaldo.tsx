import { useState } from 'react'
import {
  exportarRespaldoCompleto, citasParaCsv, clientasParaCsv, gastosParaCsv,
} from '../../lib/panel/api-panel'
import { Boton, Tarjeta, Aviso } from '../../componentes/ui'
import { mensajeDeError } from '../../lib/errores'
import { Volver } from './comunes'

function descargar(nombre: string, contenido: string, mime: string) {
  const blob = new Blob([contenido], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nombre
  document.body.appendChild(a); a.click()
  a.remove(); URL.revokeObjectURL(url)
}

function filasACsv(filas: Record<string, unknown>[]): string {
  if (filas.length === 0) return ''
  const cabecera = Object.keys(filas[0])
  const escapar = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = String(v).replace(/"/g, '""')
    return /[",\n;]/.test(s) ? `"${s}"` : s
  }
  const cuerpo = filas.map(f => cabecera.map(k => escapar(f[k])).join(',')).join('\n')
  // BOM para que Excel abra bien las tildes
  return '\uFEFF' + cabecera.join(',') + '\n' + cuerpo
}

function fechaSlug(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}`
}

type Op = 'completo' | 'citas' | 'clientas' | 'gastos' | null

export default function Respaldo() {
  const [op, setOp] = useState<Op>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function bajar(tipo: Exclude<Op, null>) {
    setOp(tipo); setError(null); setOk(null)
    try {
      const fecha = fechaSlug()
      if (tipo === 'completo') {
        const data = await exportarRespaldoCompleto()
        descargar(`nails-by-lynn-respaldo-${fecha}.json`,
          JSON.stringify(data, null, 2), 'application/json')
        setOk('Respaldo completo descargado.')
      } else if (tipo === 'citas') {
        const filas = await citasParaCsv()
        descargar(`nails-by-lynn-citas-${fecha}.csv`, filasACsv(filas), 'text/csv;charset=utf-8')
        setOk(`${filas.length} citas descargadas.`)
      } else if (tipo === 'clientas') {
        const filas = await clientasParaCsv()
        descargar(`nails-by-lynn-clientas-${fecha}.csv`, filasACsv(filas), 'text/csv;charset=utf-8')
        setOk(`${filas.length} clientas descargadas.`)
      } else if (tipo === 'gastos') {
        const filas = await gastosParaCsv()
        descargar(`nails-by-lynn-gastos-${fecha}.csv`, filasACsv(filas), 'text/csv;charset=utf-8')
        setOk(`${filas.length} gastos descargados.`)
      }
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setOp(null)
    }
  }

  return (
    <div className="p-5 space-y-5 pb-24">
      <Volver />
      <h1 className="text-[30px] leading-tight">Respaldo</h1>

      <p className="text-[14px] text-tinta-suave">
        Descarga una copia de tus datos en tu teléfono o computadora.
        Guárdala en un lugar seguro (correo, nube).
      </p>

      {error && <Aviso>{error}</Aviso>}
      {ok && <Aviso tipo="aviso">{ok}</Aviso>}

      <Tarjeta className="space-y-3">
        <div>
          <div className="text-[16px] font-medium flex items-center gap-2">
            <span className="text-[20px]">💾</span> Respaldo completo
          </div>
          <div className="text-[13px] text-tinta-tenue mt-1">
            Todos tus datos en un solo archivo JSON: negocio, servicios, clientas, citas, pagos y gastos.
            Sirve para restaurar si algo pasa.
          </div>
        </div>
        <Boton ancho onClick={() => bajar('completo')} cargando={op === 'completo'}>
          Descargar respaldo completo
        </Boton>
      </Tarjeta>

      <section>
        <h2 className="text-[16px] font-medium mb-2">Descargas para abrir en Excel</h2>
        <p className="text-[13px] text-tinta-tenue mb-3">
          Formato CSV: puedes abrirlo con Excel, Google Sheets o cualquier hoja de cálculo.
        </p>

        <div className="space-y-2">
          <Tarjeta className="flex items-center gap-3">
            <span className="text-[24px] shrink-0">📅</span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium">Todas las citas</div>
              <div className="text-[12px] text-tinta-tenue">Fecha, cliente, servicios, estado, monto</div>
            </div>
            <Boton variante="secundario" onClick={() => bajar('citas')} cargando={op === 'citas'}>
              CSV
            </Boton>
          </Tarjeta>

          <Tarjeta className="flex items-center gap-3">
            <span className="text-[24px] shrink-0">👤</span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium">Clientas</div>
              <div className="text-[12px] text-tinta-tenue">Nombres, teléfonos, visitas, gasto total</div>
            </div>
            <Boton variante="secundario" onClick={() => bajar('clientas')} cargando={op === 'clientas'}>
              CSV
            </Boton>
          </Tarjeta>

          <Tarjeta className="flex items-center gap-3">
            <span className="text-[24px] shrink-0">💸</span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium">Gastos</div>
              <div className="text-[12px] text-tinta-tenue">Historial completo por categoría</div>
            </div>
            <Boton variante="secundario" onClick={() => bajar('gastos')} cargando={op === 'gastos'}>
              CSV
            </Boton>
          </Tarjeta>
        </div>
      </section>

      <div className="pt-2 border-t border-rosa-100">
        <div className="text-[13px] text-tinta-tenue space-y-1.5">
          <p><b>💡 Consejo:</b> guarda el respaldo completo una vez al mes.</p>
          <p>Puedes mandártelo por correo a ti misma o subirlo a Google Drive.</p>
        </div>
      </div>
    </div>
  )
}
