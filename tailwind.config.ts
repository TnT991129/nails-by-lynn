import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rosa: {
          50:'#FEF2F8',100:'#FEE6F2',200:'#FDCDE6',300:'#FBA2D0',400:'#F66CB2',
          500:'#EE4397',600:'#D6156F',700:'#C4105F',800:'#A80E52',900:'#7C0A3C',
        },
        tinta: { DEFAULT:'#2B1721', suave:'#4A2A38', tenue:'#7A6470' },
        superficie: { blanco:'#FFFFFF', base:'#F7F4F5', rosa:'#FEF2F8' },
        estado: { exito:'#0F7A5A', aviso:'#B87514', error:'#C4342F' },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { sm:'8px', DEFAULT:'12px', lg:'20px', xl:'28px' },
      boxShadow: {
        sm:'0 1px 3px rgba(43,23,33,.06)',
        md:'0 4px 16px rgba(168,14,82,.08)',
        lg:'0 12px 32px rgba(168,14,82,.10)',
      },
      keyframes: {
        entrada: { '0%':{opacity:'0',transform:'translateY(8px)'}, '100%':{opacity:'1',transform:'none'} },
        pulso:   { '0%,100%':{opacity:'1'}, '50%':{opacity:'.5'} },
      },
      animation: { entrada:'entrada .25s ease-out both', pulso:'pulso 1.6s ease-in-out infinite' },
    },
  },
} satisfies Config
