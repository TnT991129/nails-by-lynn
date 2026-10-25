import { createElement, Fragment, useCallback, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { rpc, NEGOCIO_ID } from './supabase'

// Textos de la web de las clientas. Lynn los cambia en Panel → Más → Textos de la web
// (se guardan en settings.site_texts, supabase/textos_web.sql). Lo que no cambie usa el texto de aquí.
// {variable} se sustituye por su valor; **así** sale en negrita.

type DefTexto = { grupo: string; etiqueta: string; defecto: string; largo?: boolean; variables?: string }

export const TEXTOS = {
  // ---------- Inicio ----------
  'inicio.etiqueta':        { grupo: 'Inicio', etiqueta: 'Etiqueta sobre la foto', defecto: 'Estudio de uñas · {ubicacion}', variables: '{ubicacion}' },
  'inicio.titulo':          { grupo: 'Inicio', etiqueta: 'Frase grande sobre la foto', defecto: 'Uñas que hablan por ti' },
  'inicio.boton_reservar':  { grupo: 'Inicio', etiqueta: 'Botón de reservar', defecto: 'Reservar cita' },
  'inicio.cerrado':         { grupo: 'Inicio', etiqueta: 'Aviso cuando no tomas reservas', defecto: 'Ahora mismo no estamos tomando reservas.', largo: true },
  'inicio.horario_titulo':  { grupo: 'Inicio', etiqueta: 'Recuadro de horario (si no hay días)', defecto: 'Horario' },
  'inicio.horario_texto':   { grupo: 'Inicio', etiqueta: 'Recuadro de horario (si no hay turnos)', defecto: 'Con cita previa' },
  'inicio.ubicacion_texto': { grupo: 'Inicio', etiqueta: 'Recuadro de ubicación (debajo del lugar)', defecto: 'Cita previa' },
  'inicio.servicios_etiqueta': { grupo: 'Inicio', etiqueta: 'Servicios: etiqueta', defecto: 'Servicios' },
  'inicio.servicios_titulo':   { grupo: 'Inicio', etiqueta: 'Servicios: título', defecto: 'Elige tu estilo' },
  'inicio.servicios_ayuda':    { grupo: 'Inicio', etiqueta: 'Servicios: ayuda', defecto: 'Toca para reservar' },
  'inicio.sin_servicios':      { grupo: 'Inicio', etiqueta: 'Si no hay servicios activos', defecto: 'Estoy actualizando mis servicios. Escríbeme por WhatsApp para reservar.', largo: true },
  'inicio.resenas_etiqueta':   { grupo: 'Inicio', etiqueta: 'Opiniones: etiqueta', defecto: 'Opiniones' },
  'inicio.resenas_titulo':     { grupo: 'Inicio', etiqueta: 'Opiniones: título', defecto: 'Lo que dicen ellas' },
  'inicio.pasos_etiqueta':     { grupo: 'Inicio', etiqueta: 'Cómo reservar: etiqueta', defecto: 'Así de fácil' },
  'inicio.pasos_titulo':       { grupo: 'Inicio', etiqueta: 'Cómo reservar: título', defecto: 'Reserva en un minuto' },
  'inicio.paso1_titulo':       { grupo: 'Inicio', etiqueta: 'Paso 1: título', defecto: 'Elige tu servicio' },
  'inicio.paso1_texto':        { grupo: 'Inicio', etiqueta: 'Paso 1: texto', defecto: 'Y los extras que quieras añadir.' },
  'inicio.paso2_titulo':       { grupo: 'Inicio', etiqueta: 'Paso 2: título', defecto: 'Escoge día y turno' },
  'inicio.paso2_texto':        { grupo: 'Inicio', etiqueta: 'Paso 2: texto', defecto: 'Turnos a las {turnos}.', variables: '{turnos}' },
  'inicio.paso3_titulo':       { grupo: 'Inicio', etiqueta: 'Paso 3: título', defecto: 'Confirma y avisa' },
  'inicio.paso3_texto':        { grupo: 'Inicio', etiqueta: 'Paso 3: texto', defecto: 'Tu cita queda guardada al instante.' },
  'inicio.contacto_etiqueta':  { grupo: 'Inicio', etiqueta: 'Contacto: etiqueta', defecto: 'Contacto' },
  'inicio.contacto_titulo':    { grupo: 'Inicio', etiqueta: 'Contacto: título', defecto: '¿Tienes alguna duda?' },
  'inicio.contacto_texto':     { grupo: 'Inicio', etiqueta: 'Contacto: texto', defecto: 'Escríbeme y te respondo en cuanto pueda. Estoy en {ubicacion}.', largo: true, variables: '{ubicacion}' },
  'inicio.boton_whatsapp':     { grupo: 'Inicio', etiqueta: 'Botón de WhatsApp', defecto: 'Escribir por WhatsApp' },
  'inicio.enlace_politicas':   { grupo: 'Inicio', etiqueta: 'Enlace a las políticas', defecto: 'Políticas del estudio' },

  // ---------- Menú de abajo ----------
  'menu.inicio':    { grupo: 'Menú de abajo', etiqueta: 'Inicio', defecto: 'Inicio' },
  'menu.galeria':   { grupo: 'Menú de abajo', etiqueta: 'Galería', defecto: 'Galería' },
  'menu.reservar':  { grupo: 'Menú de abajo', etiqueta: 'Botón central', defecto: 'Reservar' },
  'menu.mis_citas': { grupo: 'Menú de abajo', etiqueta: 'Mis citas', defecto: 'Mis citas' },

  // ---------- Reservar ----------
  'reserva.cabecera':       { grupo: 'Reservar', etiqueta: 'Título de arriba', defecto: 'Reservar cita' },
  'reserva.paso1_titulo':   { grupo: 'Reservar', etiqueta: 'Servicio: pregunta', defecto: '¿Qué te vas a hacer?' },
  'reserva.paso1_texto':    { grupo: 'Reservar', etiqueta: 'Servicio: ayuda', defecto: 'Puedes elegir más de un servicio.' },
  'reserva.paso2_titulo':   { grupo: 'Reservar', etiqueta: 'Extras: pregunta', defecto: '¿Necesitas algo más?' },
  'reserva.paso2_texto':    { grupo: 'Reservar', etiqueta: 'Extras: ayuda', defecto: 'Añade uno o varios extras, o sigue sin añadir nada.' },
  'reserva.paso3_titulo':   { grupo: 'Reservar', etiqueta: 'Fecha: pregunta', defecto: '¿Qué día te viene bien?' },
  'reserva.paso3_texto':    { grupo: 'Reservar', etiqueta: 'Fecha: ayuda', defecto: 'Trabajo de {dias}.', variables: '{dias}' },
  'reserva.paso4_titulo':   { grupo: 'Reservar', etiqueta: 'Turno: título', defecto: 'Elige tu turno' },
  'reserva.paso5_titulo':   { grupo: 'Reservar', etiqueta: 'Datos: título', defecto: 'Cuéntanos de ti' },
  'reserva.paso5_texto':    { grupo: 'Reservar', etiqueta: 'Datos: ayuda', defecto: 'Solo lo necesario para confirmarte la cita.' },
  'reserva.ayuda_telefono': { grupo: 'Reservar', etiqueta: 'Datos: ayuda del teléfono', defecto: 'Te escribo aquí para confirmarte la cita.' },
  'reserva.ayuda_nota':     { grupo: 'Reservar', etiqueta: 'Datos: pregunta de la nota', defecto: '¿Algo que deba saber? (opcional)' },
  'reserva.paso6_titulo':   { grupo: 'Reservar', etiqueta: 'Resumen: título', defecto: 'Revisa tu cita' },
  'reserva.paso6_texto':    { grupo: 'Reservar', etiqueta: 'Resumen: ayuda', defecto: 'Si todo está bien, confírmala abajo.' },
  'reserva.importante':     { grupo: 'Reservar', etiqueta: 'Resumen: aviso verde', largo: true,
    defecto: '**Importante:** al confirmar, toca el botón verde **«Avisar a Lynn por WhatsApp»** para que sepa de tu cita y te la confirme.' },
  'reserva.boton_confirmar': { grupo: 'Reservar', etiqueta: 'Botón de confirmar', defecto: 'Confirmar cita' },

  // ---------- Página de la cita ----------
  'cita.nueva_titulo':   { grupo: 'Página de la cita', etiqueta: 'Recién reservada: título', defecto: '¡Tu cita está reservada!' },
  'cita.nueva_texto':    { grupo: 'Página de la cita', etiqueta: 'Recién reservada: texto', defecto: 'Tu turno ya está guardado. Te falta un paso: avisar a Lynn 👇', largo: true },
  'cita.titulo':         { grupo: 'Página de la cita', etiqueta: 'Título al volver a abrirla', defecto: 'Tu cita' },
  'cita.aviso_texto':    { grupo: 'Página de la cita', etiqueta: 'Aviso para escribir a Lynn', largo: true,
    defecto: '**Avisa a Lynn por WhatsApp** para que sepa de tu cita y te la confirme. El mensaje ya va escrito: solo tienes que tocar **Enviar**.' },
  'cita.aviso_boton':    { grupo: 'Página de la cita', etiqueta: 'Botón verde de aviso', defecto: 'Avisar a Lynn por WhatsApp' },
  'cita.boton_escribir': { grupo: 'Página de la cita', etiqueta: 'Botón de escribir', defecto: 'Escribir a Lynn' },

  // ---------- Mis citas ----------
  'mis_citas.etiqueta':        { grupo: 'Mis citas', etiqueta: 'Etiqueta', defecto: 'Tus reservas' },
  'mis_citas.titulo':          { grupo: 'Mis citas', etiqueta: 'Título', defecto: 'Mis citas' },
  'mis_citas.vacio_titulo':    { grupo: 'Mis citas', etiqueta: 'Sin citas: título', defecto: 'Aún no tienes citas' },
  'mis_citas.vacio_texto':     { grupo: 'Mis citas', etiqueta: 'Sin citas: texto', defecto: 'Reserva la primera y aparecerá aquí.' },
  'mis_citas.sin_proximas_titulo': { grupo: 'Mis citas', etiqueta: 'Sin citas próximas: título', defecto: 'Sin citas próximas' },
  'mis_citas.sin_proximas_texto':  { grupo: 'Mis citas', etiqueta: 'Sin citas próximas: texto', defecto: 'Reserva cuando quieras.' },
  'mis_citas.historial':       { grupo: 'Mis citas', etiqueta: 'Título del historial', defecto: 'Historial' },
  'mis_citas.falta_avisar':    { grupo: 'Mis citas', etiqueta: 'Marca de cita sin avisar', defecto: '● Falta avisar a Lynn' },

  // ---------- Galería, Servicios y Políticas ----------
  'galeria.etiqueta':     { grupo: 'Galería', etiqueta: 'Etiqueta', defecto: 'Portafolio' },
  'galeria.titulo':       { grupo: 'Galería', etiqueta: 'Título', defecto: 'Galería' },
  'galeria.texto':        { grupo: 'Galería', etiqueta: 'Texto', defecto: 'Los últimos trabajos, hechos con mucho cariño.' },
  'galeria.favoritas':    { grupo: 'Galería', etiqueta: 'Título de las destacadas', defecto: 'Favoritas' },
  'galeria.vacio_titulo': { grupo: 'Galería', etiqueta: 'Sin fotos: título', defecto: 'Aún no hay fotos' },
  'galeria.vacio_texto':  { grupo: 'Galería', etiqueta: 'Sin fotos: texto', defecto: 'Pronto tendremos los primeros trabajos aquí.' },
  'servicios.titulo':     { grupo: 'Servicios', etiqueta: 'Título', defecto: 'Servicios' },
  'servicios.boton':      { grupo: 'Servicios', etiqueta: 'Botón de cada servicio', defecto: 'Reservar' },
  'politicas.etiqueta':   { grupo: 'Políticas', etiqueta: 'Etiqueta', defecto: 'Nails by Lynn' },
  'politicas.titulo':     { grupo: 'Políticas', etiqueta: 'Título', defecto: 'Políticas del estudio' },
} satisfies Record<string, DefTexto>

export type ClaveTexto = keyof typeof TEXTOS
export type TextosGuardados = Partial<Record<ClaveTexto, string>>
type Variables = Record<string, string | number | null | undefined>

const CLAVE_LOCAL = 'nbl.textos'

function leerLocal(): TextosGuardados | undefined {
  try { const v = localStorage.getItem(CLAVE_LOCAL); return v ? JSON.parse(v) : undefined } catch { return undefined }
}

async function obtenerTextos(): Promise<TextosGuardados> {
  try {
    const r = await rpc<TextosGuardados | null>('obtener_textos', { p_business_id: NEGOCIO_ID })
    const textos = r && typeof r === 'object' ? r : {}
    try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify(textos)) } catch { /* modo privado */ }
    return textos
  } catch {
    return leerLocal() ?? {}   // sin conexión o sin el SQL: lo último visto o los textos de siempre
  }
}

/** t('inicio.titulo') → el texto de Lynn o el de siempre; t(clave, { turnos }) rellena {turnos} */
export function useTextos() {
  // Lo último guardado en el móvil se ve al instante, sin parpadeo, mientras llega lo nuevo
  const q = useQuery({ queryKey: ['textos'], queryFn: obtenerTextos, staleTime: 10 * 60_000, placeholderData: leerLocal })
  const propios = q.data
  return useCallback((clave: ClaveTexto, vars: Variables = {}, defecto?: string | null) => {
    const base = propios?.[clave]?.trim() || defecto?.trim() || TEXTOS[clave].defecto
    return base.replace(/\{(\w+)\}/g, (_, v: string) => String(vars[v] ?? ''))
  }, [propios])
}

/** Texto con **negritas** convertido en elementos (para los avisos largos) */
export function conNegritas(texto: string): ReactNode {
  return texto.split(/\*\*(.+?)\*\*/g).map((parte, i) =>
    i % 2 === 1 ? createElement('b', { key: i, className: 'text-tinta' }, parte) : createElement(Fragment, { key: i }, parte))
}
