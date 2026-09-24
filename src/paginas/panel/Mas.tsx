import { Link } from 'react-router-dom'
import { Tarjeta } from '../../componentes/ui'

const ITEMS = [
  { a: '/panel/servicios', titulo: 'Servicios', desc: 'Precios, duración y complementos' },
  { a: '/panel/horarios',  titulo: 'Horarios',  desc: 'Días laborables y bloqueos' },
]

export default function Mas() {
  return (
    <div className="p-5 space-y-3">
      <h1 className="font-display text-[30px]">Más</h1>
      {ITEMS.map(i => (
        <Link key={i.a} to={i.a}>
          <Tarjeta className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[16px] font-medium">{i.titulo}</div>
              <div className="text-[14px] text-tinta-tenue">{i.desc}</div>
            </div>
            <span className="text-rosa-600 text-[20px]">›</span>
          </Tarjeta>
        </Link>
      ))}
      <div className="pt-4 text-[13px] text-tinta-tenue text-center">
        Estadísticas, gastos y galería en la próxima entrega.
      </div>
    </div>
  )
}
