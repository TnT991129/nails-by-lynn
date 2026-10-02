// Estrellas de 1 a 5: solo para mostrar, o para elegir si se pasa onElegir
export default function Estrellas({ valor, onElegir, tam = 18 }: {
  valor: number; onElegir?: (n: number) => void; tam?: number
}) {
  return (
    <div className="flex items-center gap-0.5" role={onElegir ? 'radiogroup' : 'img'}
         aria-label={onElegir ? 'Valoración' : `${valor} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map(n => {
        const llena = n <= Math.round(valor)
        const estrella = (
          <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden
               className={llena ? 'text-[#F5B301]' : 'text-rosa-200'} fill="currentColor">
            <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" />
          </svg>
        )
        return onElegir ? (
          <button key={n} type="button" role="radio" aria-checked={n === valor} aria-label={`${n} estrellas`}
            onClick={() => onElegir(n)} className="p-1.5 -m-0.5 active:scale-90 transition">
            {estrella}
          </button>
        ) : <span key={n}>{estrella}</span>
      })}
    </div>
  )
}
