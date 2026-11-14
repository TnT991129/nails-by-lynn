import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import InstalarPanel from './InstalarPanel'
import TasaDolar from './TasaDolar'
import AvisosMovil from './AvisosMovil'
import EnlaceClientas from './EnlaceClientas'
import { Cabecera, Seccion } from './piezas'
import {
  IconoGaleria, IconoBillete, IconoPersonas, IconoDestellos, IconoCalendario, IconoReloj, IconoDescarga, IconoEstrella,
  IconoRegalo, IconoTarjeta, IconoPaleta, IconoTexto, IconoEscudo, IconoInicio,
} from '../../componentes/iconos'

type Item = { a: string; titulo: string; desc: string; icono: ReactNode }

// Todo lo que no es el día a día (Hoy, Agenda, Clientas, Estadísticas), agrupado por temas
const GRUPOS: { titulo: string; items: Item[] }[] = [
  { titulo: 'Día a día', items: [
    { a: '/panel/espera',  titulo: 'Lista de espera', desc: 'Clientas esperando un turno libre', icono: <IconoReloj /> },
    { a: '/panel/gastos',  titulo: 'Gastos',          desc: 'Material, transporte, marketing',   icono: <IconoBillete /> },
    { a: '/panel/bonos',   titulo: 'Bonos regalo',    desc: 'Vender bonos y ver su saldo',       icono: <IconoRegalo /> },
  ] },
  { titulo: 'Premios para tus clientas', items: [
    { a: '/panel/fidelidad',       titulo: 'Tarjeta de fidelidad', desc: 'Sellos y premios para las que vuelven', icono: <IconoTarjeta /> },
    { a: '/panel/recomendaciones', titulo: 'Recomendaciones',      desc: 'Premio a quien trae a una amiga',       icono: <IconoPersonas /> },
    { a: '/panel/opiniones',       titulo: 'Opiniones',            desc: 'Valoraciones y cuáles salen en la web', icono: <IconoEstrella /> },
  ] },
  { titulo: 'Tu negocio', items: [
    { a: '/panel/servicios', titulo: 'Servicios', desc: 'Precios, fotos y complementos',        icono: <IconoDestellos /> },
    { a: '/panel/horarios',  titulo: 'Horarios',  desc: 'Semana, vacaciones y bloqueos',        icono: <IconoCalendario /> },
    { a: '/panel/politicas', titulo: 'Políticas', desc: 'Reglas de reserva, cambios y cancelación', icono: <IconoEscudo /> },
  ] },
  { titulo: 'Tu web', items: [
    { a: '/panel/galeria', titulo: 'Galería',  desc: 'Subir y publicar fotos',                 icono: <IconoGaleria /> },
    { a: '/panel/diseno',  titulo: 'Diseño',   desc: 'Colores, letras, secciones y animaciones', icono: <IconoPaleta /> },
    { a: '/panel/portada', titulo: 'Portada',  desc: 'La foto grande de arriba',               icono: <IconoInicio /> },
    { a: '/panel/textos',  titulo: 'Textos',   desc: 'Cambia lo que leen las clientas',        icono: <IconoTexto /> },
  ] },
]

function Lista({ items }: { items: Item[] }) {
  return (
    <div className="bg-papel rounded-xl border border-rosa-100/80 shadow-suave divide-y divide-rosa-100 overflow-hidden">
      {items.map(i => (
        <Link key={i.a} to={i.a} className="flex items-center gap-3 px-4 py-3 min-h-[60px] active:bg-rosa-50 transition-colors">
          <span className="w-9 h-9 rounded-full bg-rosa-50 text-rosa-600 flex items-center justify-center shrink-0">{i.icono}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold">{i.titulo}</div>
            <div className="text-[13px] text-tinta-tenue truncate">{i.desc}</div>
          </div>
          <span className="text-rosa-400 text-[20px] leading-none" aria-hidden>›</span>
        </Link>
      ))}
    </div>
  )
}

export default function Mas() {
  return (
    <div className="p-5 space-y-6">
      <Cabecera titulo="Más" />
      <InstalarPanel />
      {GRUPOS.map(g => (
        <Seccion key={g.titulo} titulo={g.titulo}>
          <Lista items={g.items} />
          {g.titulo === 'Tu web' && <EnlaceClientas />}
        </Seccion>
      ))}
      <Seccion titulo="Ajustes">
        <TasaDolar />
        <AvisosMovil />
        <Lista items={[{ a: '/panel/respaldo', titulo: 'Respaldo', desc: 'Descargar una copia de tus datos', icono: <IconoDescarga /> }]} />
      </Seccion>
    </div>
  )
}
