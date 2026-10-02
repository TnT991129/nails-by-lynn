// Alergias o cuidados de la clienta, bien visibles en rojo
export default function AvisoAlergias({ texto }: { texto: string | null | undefined }) {
  if (!texto?.trim()) return null
  return (
    <div role="alert" className="rounded-xl border-2 border-estado-error bg-estado-error-fondo px-4 py-3">
      <div className="text-[12px] font-bold tracking-wider uppercase text-estado-error">⚠️ Alergias / cuidados</div>
      <div className="text-[15px] font-medium mt-0.5 whitespace-pre-line">{texto.trim()}</div>
    </div>
  )
}
