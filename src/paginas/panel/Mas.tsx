import { Link } from 'react-router-dom'
import { Tarjeta } from '../../componentes/ui'

const ITEMS = [
  { a: '/panel/estadisticas', titulo: 'Estadísticas', desc: 'Ingresos, neto, clientas top', icono: '📊' },
  { a: '/panel/gastos',       titulo: 'Gastos',       desc: 'Material, transporte, marketing', icono: '💸' },
  { a: '/panel/servicios',    titulo: 'Servicios',    desc: 'Precios, duración y complementos', icono: '💅' },
  { a: '/panel/horarios',     titulo: 'Horarios',     desc: 'Días laborables y bloqueos', icono: '📅' },
  { a: '/panel/respaldo',     titulo: 'Respaldo',     desc: 'Descargar copia de tus datos', icono: '💾' },
]

export default function Mas() {
  return (
    <div className="p-5 space-y-3">
      <h1 className="font-display text-[30px]">Más</h1>
      {ITEMS.map(i => (
        <Link key={i.a} to={i.a}>
          <Tarjeta className="flex items-center gap-3">
            <span className="text-[24px]">{i.icono}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-medium">{i.titulo}</div>
              <div className="text-[14px] text-tinta-tenue truncate">{i.desc}</div>
            </div>
            <span className="text-rosa-600 text-[20px]">›</span>
          </Tarjeta>
        </Link>
      ))}
      <div className="pt-4 text-[13px] text-tinta-tenue text-center">
        Galería con fotos en la próxima entrega.
      </div>
    </div>
  )
}
