import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { resumenMes, topServiciosMes, topClientasMes } from '../../lib/panel/api-panel'
import ResumenSemanal from './ResumenSemanal'
import { Tarjeta, Esqueleto, Aviso } from '../../componentes/ui'
import { IconoAtras, IconoFlecha } from '../../componentes/iconos'
import { importe, fechaISO } from '../../lib/formato'
import { mensajeDeError } from '../../lib/errores'
import EmbudoWeb from './EmbudoWeb'
import { Cabecera, Seccion, Pestanas, Cifras } from './piezas'

const NOMBRES_MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

type Vista = 'mes' | 'semana' | 'web'

// Una fila de ranking con su barra (lo más alto llena la barra)
function Ranking({ filas }: { filas: { clave: string; nombre: string; apoyo: string; valor: number }[] }) {
  const maximo = Math.max(1, ...filas.map(f => f.valor))
  return (
    <Tarjeta className="!p-0 divide-y divide-rosa-100 overflow-hidden">
      {filas.map((f, i) => (
        <div key={f.clave} className="px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0 flex items-baseline gap-2">
              <span className="text-[12px] text-tinta-tenue w-4 shrink-0">{i + 1}</span>
              <span className="text-[15px] font-medium truncate">{f.nombre}</span>
            </div>
            <span className="font-display text-[16px] shrink-0">{importe(f.valor)}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 pl-6">
            <span className="flex-1 h-1.5 rounded-full bg-rosa-50 overflow-hidden">
              <span className="block h-full rounded-full bg-gradient-to-r from-rosa-400 to-rosa-600"
                    style={{ width: `${Math.max(4, f.valor / maximo * 100)}%` }} />
            </span>
            <span className="text-[12px] text-tinta-tenue shrink-0">{f.apoyo}</span>
          </div>
        </div>
      ))}
    </Tarjeta>
  )
}

// Tres vistas: el dinero del mes (lo primero), la semana comparada con la anterior y las visitas de la web
export default function Estadisticas() {
  const [vista, setVista] = useState<Vista>('mes')
  // Mes actual según La Habana
  const [añoHoy, mesHoy] = fechaISO(new Date()).split('-').map(Number)
  const [año, setAño] = useState(añoHoy)
  const [mes, setMes] = useState(mesHoy - 1)

  function mover(dir: -1 | 1) {
    let m = mes + dir; let a = año
    if (m < 0) { m = 11; a-- }
    if (m > 11) { m = 0; a++ }
    setMes(m); setAño(a)
  }

  const esMesActual = año === añoHoy && mes === mesHoy - 1

  const qResumen = useQuery({
    queryKey: ['resumen', año, mes],
    queryFn: () => resumenMes(año, mes),
  })
  const qServ = useQuery({
    queryKey: ['top-serv', año, mes],
    queryFn: () => topServiciosMes(año, mes),
  })
  const qCli = useQuery({
    queryKey: ['top-cli', año, mes],
    queryFn: () => topClientasMes(año, mes),
  })
  const r = qResumen.data

  return (
    <div className="p-5 space-y-5">
      <Cabecera titulo="Estadísticas" />
      <Pestanas etiqueta="Qué ver" valor={vista} onChange={setVista}
        opciones={[{ clave: 'mes', titulo: 'Mes' }, { clave: 'semana', titulo: 'Semana' }, { clave: 'web', titulo: 'Tu web' }]} />

      {vista === 'semana' && <ResumenSemanal />}
      {vista === 'web' && <EmbudoWeb />}

      {vista === 'mes' && (
        <>
          <div className="flex items-center justify-between bg-papel rounded-full border border-rosa-100 px-1">
            <button onClick={() => mover(-1)} aria-label="Mes anterior"
              className="w-11 h-11 flex items-center justify-center text-tinta-suave"><IconoAtras tam={18} /></button>
            <span className="text-[15px] font-semibold">{NOMBRES_MES[mes]} {año}</span>
            <button onClick={() => mover(1)} disabled={esMesActual} aria-label="Mes siguiente"
              className="w-11 h-11 flex items-center justify-center text-tinta-suave disabled:opacity-30"><IconoFlecha tam={18} /></button>
          </div>

          {qResumen.isLoading && <Esqueleto className="h-40" />}
          {qResumen.isError && <Aviso>{mensajeDeError(qResumen.error)}</Aviso>}

          {r && (
            <>
              {/* Lo que quedó en el mes, y de dónde sale */}
              <div className={`rounded-xl p-5 text-center border ${r.neto >= 0
                ? 'bg-gradient-to-br from-rosa-500 via-rosa-600 to-vino text-white border-transparent shadow-boton'
                : 'bg-estado-error-fondo border-estado-error/30 text-estado-error'}`}>
                <div className="text-[11px] font-semibold tracking-[0.2em] uppercase opacity-80">Te quedó este mes</div>
                <div className="font-display text-[40px] leading-none mt-2">{importe(r.neto)}</div>
                <div className="text-[13px] opacity-85 mt-2">{importe(r.ingresos)} de ingresos − {importe(r.gastos)} de gastos</div>
              </div>

              <Cifras datos={[
                { etiqueta: 'Ingresos', valor: importe(r.ingresos) },
                { etiqueta: 'Gastos', valor: importe(r.gastos) },
                { etiqueta: 'Por cita', valor: importe(r.ticket_promedio) },
              ]} />

              {r.citas_completadas > 0 && (
                <Seccion titulo="Cobros">
                  <Tarjeta className="!py-3.5 space-y-2">
                    <div className="flex justify-between text-[14px]">
                      <span className="text-tinta-suave">Cobrado</span>
                      <b className="text-estado-exito">{importe(r.cobrado)}</b>
                    </div>
                    {Math.abs(r.sobre_estimado) > 0.009 && (
                      <div className="flex justify-between text-[14px]">
                        <span className="text-tinta-suave">Frente al precio estimado</span>
                        <b>{r.sobre_estimado > 0 ? '+' : '−'}{importe(Math.abs(r.sobre_estimado))}</b>
                      </div>
                    )}
                    {r.sin_cobro > 0 && (
                      <div className="flex justify-between text-[14px]">
                        <span className="text-tinta-suave">{r.sin_cobro} {r.sin_cobro === 1 ? 'cita' : 'citas'} sin apuntar el cobro</span>
                        <b className="text-estado-aviso">≈ {importe(r.sin_cobro_estimado)}</b>
                      </div>
                    )}
                    <p className="text-[12px] text-tinta-tenue pt-1">
                      Los ingresos son lo que apuntas en «Cobrar» en cada cita. Si no lo apuntas, cuenta el precio estimado.
                    </p>
                  </Tarjeta>
                </Seccion>
              )}

              <Seccion titulo="Citas del mes">
                <Cifras datos={[
                  { etiqueta: 'Hechas', valor: r.citas_completadas },
                  { etiqueta: 'Clientas', valor: r.clientas_atendidas },
                  { etiqueta: 'No vino', valor: r.citas_no_show, tono: r.citas_no_show > 0 ? 'error' : 'normal' },
                  { etiqueta: 'Canceló', valor: r.citas_canceladas },
                ]} />
              </Seccion>
            </>
          )}

          <Seccion titulo="Servicios que más dejan">
            {qServ.isLoading && <Esqueleto className="h-24" />}
            {qServ.data && qServ.data.length === 0 && <p className="text-[14px] text-tinta-tenue px-1">Sin datos este mes.</p>}
            {qServ.data && qServ.data.length > 0 && (
              <Ranking filas={qServ.data.map(s => ({
                clave: s.nombre, nombre: s.nombre, valor: s.ingresos, apoyo: `${s.cantidad} ${s.cantidad === 1 ? 'cita' : 'citas'}`,
              }))} />
            )}
          </Seccion>

          <Seccion titulo="Clientas que más vienen">
            {qCli.isLoading && <Esqueleto className="h-24" />}
            {qCli.data && qCli.data.length === 0 && <p className="text-[14px] text-tinta-tenue px-1">Sin datos este mes.</p>}
            {qCli.data && qCli.data.length > 0 && (
              <Ranking filas={qCli.data.map(c => ({
                clave: c.id, nombre: c.nombre, valor: c.gastado, apoyo: `${c.visitas} ${c.visitas === 1 ? 'visita' : 'visitas'}`,
              }))} />
            )}
          </Seccion>
        </>
      )}
    </div>
  )
}
