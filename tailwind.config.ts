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
        vino: v('vino'),          // final de los degradados de botón: igual en claro y oscuro (texto blanco legible)
        acento: v('acento-claro'), // rosa claro sobre fondos oscuros (contacto, portada)
        estado: {
          exito:v('exito'), aviso:v('aviso'), error:v('error'),
          'exito-fondo':v('exito-fondo'), 'aviso-fondo':v('aviso-fondo'), 'error-fondo':v('error-fondo'),
        },
        whatsapp: { DEFAULT:'#25D366', oscuro:'#20BA5A', fondo:v('wa-fondo'), texto:v('wa-texto') },
      },
      fontFamily: {
        // Sin fuentes descargadas: se usan las del propio móvil para no gastar datos
        // Variables: Lynn elige la tipografía en Diseño de la web (src/lib/diseno.ts)
        display: ['var(--fuente-titulos)'],
        sans: ['var(--fuente-texto)'],
      },
      // Esquinas y botones según Diseño de la web
      borderRadius: { sm:'var(--radio-sm)', DEFAULT:'var(--radio)', lg:'var(--radio-lg)', xl:'var(--radio-xl)', boton:'var(--radio-boton)' },
      boxShadow: {
        sm:'0 1px 3px rgba(43,23,33,.06)',
        md:'0 4px 16px rgb(var(--vino) / .08)',
        lg:'0 12px 32px rgb(var(--vino) / .10)',
        suave:'0 1px 2px rgba(43,23,33,.04), 0 8px 24px -12px rgb(var(--vino) / .14)',
        boton:'0 10px 24px -10px rgb(var(--rosa-600) / .55)',
        brillo:'0 0 0 1px rgb(var(--rosa-200) / .6), 0 18px 40px -18px rgb(var(--rosa-600) / .45)',
        flota:'0 -8px 30px -12px rgba(43,23,33,.18)',
      },
      keyframes: {
        entrada: { '0%':{opacity:'0',transform:'translateY(8px)'}, '100%':{opacity:'1',transform:'none'} },
        pulso:   { '0%,100%':{opacity:'1'}, '50%':{opacity:'.5'} },
        latido:  { '0%,100%':{transform:'scale(1)'}, '50%':{transform:'scale(1.03)'} },
        pagina:  { '0%':{opacity:'0',transform:'translateY(14px)'}, '100%':{opacity:'1',transform:'none'} },
        pop:     { '0%':{opacity:'0',transform:'scale(.6)'}, '60%':{opacity:'1',transform:'scale(1.12)'}, '100%':{transform:'scale(1)'} },
        flotar:  { '0%,100%':{transform:'translate3d(0,0,0) rotate(0)'}, '50%':{transform:'translate3d(0,-10px,0) rotate(6deg)'} },
        deriva:  { '0%,100%':{transform:'translate3d(0,0,0) scale(1)'}, '33%':{transform:'translate3d(24px,-18px,0) scale(1.08)'},
                   '66%':{transform:'translate3d(-18px,14px,0) scale(.95)'} },
        centelleo: { '0%,100%':{opacity:'.25',transform:'scale(.7) rotate(0)'}, '50%':{opacity:'1',transform:'scale(1.1) rotate(25deg)'} },
        acercar: { '0%':{transform:'scale(1.14)'}, '100%':{transform:'scale(1.04)'} },
        'paso-adelante': { '0%':{opacity:'0',transform:'translateX(36px)'}, '100%':{opacity:'1',transform:'none'} },
        'paso-atras':    { '0%':{opacity:'0',transform:'translateX(-36px)'}, '100%':{opacity:'1',transform:'none'} },
        trazo:   { '0%':{transform:'scaleY(0)'}, '100%':{transform:'scaleY(1)'} },
        ampliar: { '0%':{opacity:'0',transform:'scale(.86)'}, '100%':{opacity:'1',transform:'none'} },
        girar:   { '0%':{opacity:'0',transform:'perspective(600px) rotateX(-75deg) translateY(12px)'}, '100%':{opacity:'1',transform:'none'} },
      },
      // «backwards» y no «both»: al terminar no dejan ninguna transformación puesta. Una transformación que queda
      // (aunque sea «none» animado) convierte al elemento en el marco de todo lo «fixed» que lleva dentro:
      // la barra del panel, las ventanas y el visor dejaban de estar fijos en la pantalla.
      animation: { entrada:'entrada .25s ease-out backwards', pulso:'pulso 1.6s ease-in-out infinite',
                   latido:'latido 1.8s ease-in-out infinite',
                   pagina:'pagina .45s cubic-bezier(.22,1,.36,1) backwards',
                   pop:'pop .45s cubic-bezier(.34,1.56,.64,1) backwards',
                   flotar:'flotar 7s ease-in-out infinite',
                   deriva:'deriva 14s ease-in-out infinite',
                   centelleo:'centelleo 2.8s ease-in-out infinite',
                   acercar:'acercar 2.4s cubic-bezier(.22,1,.36,1) both',
                   'paso-adelante':'paso-adelante .4s cubic-bezier(.22,1,.36,1) backwards',
                   'paso-atras':'paso-atras .4s cubic-bezier(.22,1,.36,1) backwards',
                   trazo:'trazo 1.2s cubic-bezier(.22,1,.36,1) backwards',
                   ampliar:'ampliar .35s cubic-bezier(.22,1,.36,1) backwards',
                   girar:'girar .6s cubic-bezier(.22,1,.36,1) backwards' },
    },
  },
} satisfies Config
