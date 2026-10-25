// Edge Function «enviar-push»: manda al móvil de Lynn los avisos pendientes de push_cola
// (supabase/avisos_lynn.sql): reservas nuevas, cancelaciones, cambios de fecha o de servicios,
// lista de espera y opiniones. La llaman la base de datos al momento y el cron cada 15 min.
// Solo vacía la cola, así que no hace falta protegerla con JWT (desactivar «Enforce JWT verification»).
//
// Secretos (Supabase → Edge Functions → Secrets): VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import webpush from 'npm:web-push@3.6.7'

const SITIO = (Deno.env.get('SITIO_URL') ?? 'https://tnt991129.github.io/nails-by-lynn/').replace(/\/?$/, '/')
const ZONA = 'America/Havana'

// Las claves se comprueban al recibir la llamada: si faltan, se dice cuál en vez de romper la función
function prepararClaves(): string | null {
  const publica = Deno.env.get('VAPID_PUBLIC_KEY')?.trim()
  const privada = Deno.env.get('VAPID_PRIVATE_KEY')?.trim()
  if (!publica) return 'Falta el secreto VAPID_PUBLIC_KEY (Edge Functions → Secrets)'
  if (!privada) return 'Falta el secreto VAPID_PRIVATE_KEY (Edge Functions → Secrets)'
  try { webpush.setVapidDetails(SITIO, publica, privada) }
  catch (e) { return `Los secretos VAPID no son válidos: ${(e as Error).message}` }
  return null
}

type Item = { id: number; business_id: string; evento: string; ref_id: string }
type Aviso = { title: string; body: string; url: string; tag: string }

const fecha = (iso: string) => new Intl.DateTimeFormat('es', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' })
  .format(new Date(iso)).replace(',', '')
const hora = (iso: string) => new Intl.DateTimeFormat('es', { timeZone: ZONA, hour: 'numeric', minute: '2-digit', hour12: true })
  .format(new Date(iso)).replace(/\s?a\.\s?m\./i, ' AM').replace(/\s?p\.\s?m\./i, ' PM')
const nombre = (n: string | null | undefined) => (n ?? 'Una clienta').trim().split(/\s+/).slice(0, 2).join(' ')

// Arma el texto del aviso con los datos actuales (null = ya no tiene sentido mandarlo)
async function armarAviso(sb: SupabaseClient, item: Item): Promise<Aviso | null> {
  if (item.evento === 'espera') {
    const { data: e } = await sb.from('waitlist').select('preferred_date_from, clients(full_name)').eq('id', item.ref_id).maybeSingle()
    if (!e) return null
    const cli = (Array.isArray(e.clients) ? e.clients[0] : e.clients) as { full_name: string } | null
    return {
      title: 'Lista de espera 🕐',
      body: `${nombre(cli?.full_name)} quiere un turno el ${fecha(`${e.preferred_date_from}T16:00:00Z`)}.`,
      url: `${SITIO}panel/espera`, tag: `espera-${item.ref_id}`,
    }
  }
  if (item.evento === 'opinion') {
    const { data: r } = await sb.from('reviews').select('rating, comment, clients(full_name)').eq('id', item.ref_id).maybeSingle()
    if (!r) return null
    const cli = (Array.isArray(r.clients) ? r.clients[0] : r.clients) as { full_name: string } | null
    return {
      title: `Nueva opinión ${'⭐'.repeat(r.rating)}`,
      body: `${nombre(cli?.full_name)}${r.comment ? `: «${r.comment.slice(0, 140)}»` : ` te dio ${r.rating} de 5 estrellas.`}`,
      url: `${SITIO}panel/opiniones`, tag: `opinion-${item.ref_id}`,
    }
  }

  const { data: c } = await sb.from('v_agenda').select('id, starts_at, cliente_nombre, servicios, status').eq('id', item.ref_id).maybeSingle()
  if (!c) return null
  const quien = nombre(c.cliente_nombre)
  const cuando = `${fecha(c.starts_at)} a las ${hora(c.starts_at)}`
  const url = `${SITIO}panel/cita/${c.id}`
  const tag = `cita-${c.id}`   // un aviso nuevo de la misma cita sustituye al anterior
  switch (item.evento) {
    case 'nueva':
      return { title: 'Nueva reserva 💅', body: `${quien} · ${cuando}${c.servicios ? `\n${c.servicios}` : ''}`, url, tag }
    case 'cancelada':
      return { title: 'Cita cancelada ❌', body: `${quien} canceló su cita del ${cuando}.`, url, tag }
    case 'reagendada':
      return { title: 'Cita cambiada 📅', body: `${quien} pasó su cita al ${cuando}.`, url, tag }
    case 'editada':
      return { title: 'Cita modificada ✏️', body: `${quien} cambió su cita del ${cuando}${c.servicios ? `: ${c.servicios}` : '.'}`, url, tag }
  }
  return null
}

async function enviar(sb: SupabaseClient, item: Item): Promise<string> {
  const aviso = await armarAviso(sb, item)
  if (!aviso) return 'nada que avisar'
  const { data: moviles } = await sb.from('push_suscripciones').select('id, endpoint, p256dh, auth')
    .eq('business_id', item.business_id).contains('eventos', [item.evento])
  if (!moviles?.length) return 'sin móviles'

  const carga = JSON.stringify(aviso)
  let ok = 0
  for (const m of moviles) {
    try {
      await webpush.sendNotification({ endpoint: m.endpoint, keys: { p256dh: m.p256dh, auth: m.auth } }, carga,
        { TTL: 60 * 60 * 24 * 2, urgency: 'high' })
      ok++
      await sb.from('push_suscripciones').update({ last_ok_at: new Date().toISOString() }).eq('id', m.id)
    } catch (e) {
      const codigo = (e as { statusCode?: number }).statusCode
      // El móvil ya no acepta avisos (app borrada, permiso quitado…): se olvida
      if (codigo === 404 || codigo === 410) await sb.from('push_suscripciones').delete().eq('id', m.id)
      else console.error('push', item.id, codigo, (e as Error).message)
    }
  }
  return `enviado a ${ok} de ${moviles.length}`
}

Deno.serve(async () => {
  const fallo = prepararClaves()
  if (fallo) return Response.json({ error: fallo }, { status: 500 })
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } })
  const { data: cola, error } = await sb.rpc('tomar_cola_push', { p_limite: 50 })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  for (const item of (cola ?? []) as Item[]) {
    const resultado = await enviar(sb, item).catch(e => `error: ${(e as Error).message}`)
    await sb.from('push_cola').update({ enviado_at: new Date().toISOString(), resultado }).eq('id', item.id)
  }
  return Response.json({ procesados: cola?.length ?? 0 })
})
