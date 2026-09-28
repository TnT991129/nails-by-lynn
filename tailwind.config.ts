import type { Config } from 'tailwindcss'

// Color desde variable CSS con canales RGB, para que funcionen opacidades como bg-rosa-600/40
const v = (nombre: string) => `rgb(var(--${nombre}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Colores como variables CSS (src/index.css): claro por defecto, oscuro con html.oscuro
      colors: {
        rosa: {
          50:v('rosa-50'),100:v('rosa-100'),200:v('rosa-200'),300:v('rosa-300'),400:v('rosa-400'),
          500:v('rosa-500'),600:v('rosa-600'),700:v('rosa-700'),800:v('rosa-800'),900:v('rosa-900'),
        },
        tinta: { DEFAULT:v('tinta'), suave:v('tinta-suave'), tenue:v('tinta-tenue') },
        superficie: { blanco:v('papel'), base:v('fondo'), rosa:v('rosa-50') },
        papel: v('papel'),        // tarjetas y barras (blanco en claro)
        noche: v('noche'),        // bloques oscuros destacados (contacto, avisos)
        estado: {
          exito:v('exito'), aviso:v('aviso'), error:v('error'),
          'exito-fondo':v('exito-fondo'), 'aviso-fondo':v('aviso-fondo'), 'error-fondo':v('error-fondo'),
        },
        whatsapp: { DEFAULT:'#25D366', oscuro:'#20BA5A', fondo:v('wa-fondo'), texto:v('wa-texto') },
      },
      fontFamily: {
        // Sin fuentes descargadas: se usan las del propio móvil para no gastar datos
        display: ['"Playfair Display"', 'Didot', '"Bodoni 72"', 'Georgia', '"Noto Serif"', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { sm:'8px', DEFAULT:'12px', lg:'20px', xl:'28px' },
      boxShadow: {
        sm:'0 1px 3px rgba(43,23,33,.06)',
        md:'0 4px 16px rgba(168,14,82,.08)',
        lg:'0 12px 32px rgba(168,14,82,.10)',
        suave:'0 1px 2px rgba(43,23,33,.04), 0 8px 24px -12px rgba(168,14,82,.14)',
        boton:'0 10px 24px -10px rgba(214,21,111,.55)',
        flota:'0 -8px 30px -12px rgba(43,23,33,.18)',
      },
      keyframes: {
        entrada: { '0%':{opacity:'0',transform:'translateY(8px)'}, '100%':{opacity:'1',transform:'none'} },
        pulso:   { '0%,100%':{opacity:'1'}, '50%':{opacity:'.5'} },
        latido:  { '0%,100%':{transform:'scale(1)'}, '50%':{transform:'scale(1.03)'} },
      },
      animation: { entrada:'entrada .25s ease-out both', pulso:'pulso 1.6s ease-in-out infinite',
                   latido:'latido 1.8s ease-in-out infinite' },
    },
  },
} satisfies Config
