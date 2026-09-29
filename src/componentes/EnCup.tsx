import { useTasa } from '../lib/tasa'
import { enCup } from '../lib/formato'

// Línea pequeña bajo un precio en USD: "≈ 1.440 CUP" (o rango "≈ 960–1.920 CUP")
export default function EnCup({ min, max, className = '' }: {
  min: number; max?: number | null; className?: string
}) {
  const t = useTasa()
  if (!t || !(min > 0)) return null
  return (
    <span className={`block text-[11px] leading-tight font-sans font-normal text-tinta-tenue ${className}`}>
      ≈ {enCup(min, max, t.tasa)}
    </span>
  )
}
