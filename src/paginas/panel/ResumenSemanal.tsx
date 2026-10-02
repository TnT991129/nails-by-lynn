import { useQuery } from '@tanstack/react-query'
import { resumenSemana, type ResumenSemana } from '../../lib/panel/api-panel'
import { Tarjeta, Esqueleto } from '../../componentes/ui'
import { importe } from '../../lib/formato'

// Esta semana frente a la anterior (lunes a domingo)
export default function ResumenSemanal() {
  const q = useQuery({
    queryKey: ['semana'],
    queryFn: async () => Promise.all([resumenSemana(0), resumenSemana(-1)]),
  })
  if (q.isLoading) return <Esqueleto className="h-40" />
  if (!q.data) return null
  const [esta, pasada] = q.data

  const filas: { titulo: string; v: (r: ResumenSemana) => number; dinero?: boolean; menosEsMejor?: boolean }[] = [
    { titulo: 'Citas completadas', v: r => r.citas },
    { titulo: 'Ingresos', v: r => r.ingresos, dinero: true },
    { titulo: 'Clientas nuevas', v: r => r.nuevas },
    { titulo: 'No vinieron', v: r => r.noVino, menosEsMejor: true },
    { titulo: 'Canceladas', v: r => r.canceladas, menosEsMejor: true },
  ]
  const rango = (r: ResumenSemana) => {
    const f = (iso: string) => new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' })
      .format(new Date(iso + 'T12:00:00Z')).replace('.', '')
    const fin = new Date(new Date(r.hasta + 'T12:00:00Z').getTime() - 86_400_000).toISOString().slice(0, 10)
    return `${f(r.desde)} – ${f(fin)}`
  }

  return (
    <Tarjeta className="space-y-3">
      <div>
        <div className="text-[15px] font-semibold">Esta semana</div>
        <div className="text-[12px] text-tinta-tenue">{rango(esta)} · comparada con la anterior</div>
      </div>
      <div className="divide-y divide-rosa-100">
        {filas.map(f => {
          const a = f.v(esta), b = f.v(pasada), dif = a - b
          const bueno = f.menosEsMejor ? dif < 0 : dif > 0
          return (
            <div key={f.titulo} className="flex items-center justify-between py-2 text-[14px]">
              <span className="text-tinta-suave">{f.titulo}</span>
              <span className="flex items-baseline gap-2">
                <b className="text-[16px]">{f.dinero ? importe(a) : a}</b>
                {dif !== 0 && (
                  <span className={`text-[12px] ${bueno ? 'text-estado-exito' : 'text-estado-error'}`}>
                    {dif > 0 ? '▲' : '▼'} {f.dinero ? importe(Math.abs(dif)) : Math.abs(dif)}
                  </span>
                )}
                {dif === 0 && <span className="text-[12px] text-tinta-tenue">=</span>}
              </span>
            </div>
          )
        })}
      </div>
    </Tarjeta>
  )
}
