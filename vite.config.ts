import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En desarrollo servimos desde la raiz (localhost:5173) para que sea comodo.
// Al compilar usamos el subdirectorio que exige GitHub Pages.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/nails-by-lynn/' : '/',
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom', 'react-router-dom'] },
      },
    },
  },
}))
