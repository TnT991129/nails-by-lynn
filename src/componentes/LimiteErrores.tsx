import { Component, type ErrorInfo, type ReactNode } from 'react'
import { estiloBoton } from './ui'

// Tras publicar una versión nueva, una pestaña abierta desde antes pide archivos que ya no existen.
const ERROR_DE_VERSION = /dynamically imported module|Importing a module script failed|ChunkLoadError/i
const CLAVE_RECARGA = 'nbl-recarga-version'

/** Recarga la página una sola vez cada 30 s, para no entrar en bucle si el problema es otro */
export function recargarPorVersionNueva(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE_RECARGA) ?? 0)
    if (Date.now() - ultima < 30_000) return false
    sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()))
  } catch { /* sin almacenamiento: recargamos igual */ }
  window.location.reload()
  return true
}

type Props = { ruta: string; children: ReactNode }

// Si una pantalla falla, muestra un aviso en vez de dejar la página en blanco
export default class LimiteErrores extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error en pantalla:', error, info.componentStack)
    if (ERROR_DE_VERSION.test(error.message)) recargarPorVersionNueva()
  }

  // Al cambiar de página se vuelve a intentar
  componentDidUpdate(anteriores: Props) {
    if (this.state.error && anteriores.ruta !== this.props.ruta) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    const sinConexion = !navigator.onLine
    return (
      <div className="min-h-[70dvh] flex flex-col items-center justify-center text-center px-6 animate-entrada">
        <div className="w-16 h-16 rounded-full bg-rosa-50 border border-rosa-100 text-rosa-600
                        flex items-center justify-center text-[28px] font-display mb-5" aria-hidden>!</div>
        <h1 className="text-[26px] leading-tight">{sinConexion ? 'Sin conexión' : 'Algo salió mal'}</h1>
        <p className="text-tinta-tenue mt-2 max-w-xs text-[15px]">
          {sinConexion
            ? 'Esta página necesita internet la primera vez. Conéctate y vuelve a intentarlo.'
            : 'Recarga la página. Si vuelve a pasar, revisa tu conexión e inténtalo en un momento.'}
        </p>
        <div className="mt-6 w-full max-w-xs space-y-2.5">
          <button onClick={() => window.location.reload()} className={estiloBoton('primario', true)}>
            Recargar
          </button>
          <a href={import.meta.env.BASE_URL} className={estiloBoton('secundario', true)}>
            Volver al inicio
          </a>
        </div>
      </div>
    )
  }
}
