// Edge Function «enviar-push»: manda al móvil de cada clienta los avisos pendientes de push_cola
// (supabase/notificaciones_push.sql). La llaman la base de datos al cambiar una cita y el cron cada 15 min.
// Solo vacía la cola, así que no hace falta protegerla con JWT (desactivar «Enforce JWT verification»).
//
// Secretos (Supabase → Edge Functions → Secrets): VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import webpush from 'npm:web-push@3.6.7'

const SITIO = (Deno.env.get('SITIO_URL') ?? 'https://tnt991129.github.io/nails-by-lynn/').replace(/\/?$/, '/')
webpush.setVapidDetails(SITIO, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

// Textos por defecto; Lynn los cambia en Panel → Más → Textos de la web → «Notificaciones al móvil»
// (mismas claves y textos que src/lib/textos.ts: si cambias uno, cambia el otro)
const TEXTOS: Record<string, [string, string]> = {
  creada:            ['¡Cita reservada! 💅', 'Te espero el {fecha} a las {hora}. Código {codigo}.'],
  confirmada:        ['Cita confirmada ✅', 'Lynn confirmó tu cita del {fecha} a las {hora}.'],
  reagendada:        ['Tu cita cambió de fecha 📅', 'Ahora es el {fecha} a las {hora}.'],
  actualizada:       ['Tu cita se actualizó ✏️', 'Revisa los servicios y el precio de tu cita del {fecha}.'],
  cancelada_negocio: ['Cita cancelada', 'Lynn tuvo que cancelar tu cita del {fecha} a las {hora}. Toca para ver más.'],
  cancelada_clienta: ['Cita cancelada', 'Cancelaste tu cita del {fecha} a las {hora}. ¡Te espero otro día!'],
  completada:        ['¡Gracias por tu visita! 💖', '¿Me cuentas qué te pareció? Toca para valorar tu cita.'],
  recordatorio:      ['Mañana tienes cita 💅', 'Te espero el {fecha} a las {hora}.'],
}

type Item = { id: number; appointment_id: string; evento: string }

function rellenar(texto: string, vars: Record<string, string>) {
  return texto.replace(/\{(\w+)\}/g, (_, v: string) => vars[v] ?? '')
}

async function enviarAviso(sb: SupabaseClient, item: Item): Promise<string> {
  const { data: a } = await sb.from('appointments')
    .select('id, code, access_token, starts_at, status, client_id, business_id')
    .eq('id', item.appointment_id).maybeSingle()
  if (!a) return 'cita borrada'
  if (item.evento === 'recordatorio' && !['PENDIENTE', 'CONFIRMADA'].includes(a.status)) return 'cita ya no activa'
  const base = TEXTOS[item.evento]
  if (!base) return `evento desconocido: ${item.evento}`

  const [{ data: negocio }, { data: ajustes }, { data: moviles }] = await Promise.all([
    sb.from('businesses').select('timezone').eq('id', a.business_id).single(),
    sb.from('settings').select('site_texts').eq('business_id', a.business_id).maybeSingle(),
    sb.from('push_suscripciones').select('id, endpoint, p256dh, auth').eq('client_id', a.client_id),
  ])
  if (!moviles?.length) return 'sin móviles'

  const zona = negocio?.timezone ?? 'America/Havana'
  const inicio = new Date(a.starts_at)
  const vars = {
    fecha: new Intl.DateTimeFormat('es', { timeZone: zona, weekday: 'long', day: 'numeric', month: 'long' })
      .format(inicio).replace(',', ''),
    hora: new Intl.DateTimeFormat('es', { timeZone: zona, hour: 'numeric', minute: '2-digit', hour12: true })
      .format(inicio).replace(/\s?a\.\s?m\./i, ' AM').replace(/\s?p\.\s?m\./i, ' PM'),
    codigo: a.code,
  }
  const propios = (ajustes?.site_texts ?? {}) as Record<string, string>
  const titulo = propios[`notif.${item.evento}_titulo`]?.trim() || base[0]
  const texto = propios[`notif.${item.evento}_texto`]?.trim() || base[1]

  const carga = JSON.stringify({
    title: rellenar(titulo, vars),
    body: rellenar(texto, vars),
    url: `${SITIO}cita/${a.access_token}`,
    tag: a.code,   // un aviso nuevo de la misma cita sustituye al anterior
  })

  let ok = 0
  for (const m of moviles) {
    try {
      await webpush.sendNotification({ endpoint: m.endpoint, keys: { p256dh: m.p256dh, auth: m.auth } }, carga,
        { TTL: 60 * 60 * 24 * 2, urgency: 'high' })
      ok++
      await sb.from('push_suscripciones').update({ last_ok_at: new Date().toISOString() }).eq('id', m.id)
    } catch (e) {
      const codigo = (e as { statusCode?: number }).statusCode
      // El móvil ya no acepta avisos (desinstalada, permiso quitado…): se olvida
      if (codigo === 404 || codigo === 410) await sb.from('push_suscripciones').delete().eq('id', m.id)
      else console.error('push', item.id, codigo, (e as Error).message)
    }
  }
  return `enviado a ${ok} de ${moviles.length}`
}

Deno.serve(async () => {
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } })
  const { data: cola, error } = await sb.rpc('tomar_cola_push', { p_limite: 50 })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  for (const item of (cola ?? []) as Item[]) {
    const resultado = await enviarAviso(sb, item).catch(e => `error: ${(e as Error).message}`)
    await sb.from('push_cola').update({ enviado_at: new Date().toISOString(), resultado }).eq('id', item.id)
  }
  return Response.json({ procesados: cola?.length ?? 0 })
})
