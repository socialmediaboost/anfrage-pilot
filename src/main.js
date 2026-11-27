import './style.css'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
const app = document.getElementById('app')
const ST = ['Neu', 'Beantwortet', 'Termin gebucht', 'Verloren']
let user = null, biz = null, inq = [], tab = 'dash', modal = null, toast = ''

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const fmt = d => new Date(d).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
const fill = (t, i) => (t || '').replaceAll('{name}', i.name || '').replaceAll('{link}', biz.booking_link || '').replaceAll('{betrieb}', biz.name || '')
const daysLeft = () => Math.max(0, Math.ceil((new Date(biz.trial_ends) - Date.now()) / 864e5))
const say = m => { toast = m; render(); setTimeout(() => { toast = ''; render() }, 2200) }

async function load() {
  let { data } = await sb.from('businesses').select('*').limit(1)
  if (!data?.length) data = [(await sb.from('businesses').insert({}).select().single()).data]
  biz = data[0]
  inq = (await sb.from('inquiries').select('*').order('created_at', { ascending: false })).data || []
}

const authView = () => `<div class="auth card"><h2>📬 AnfragenPilot</h2>
<p class="m">Keine Anfrage mehr verlieren: Sofort-Antwort, Buchungslink und Übersicht an einem Ort.</p>
<label>E-Mail</label><input id="em" type="email"><label>Passwort (mind. 6 Zeichen)</label><input id="pw" type="password">
<div class="row"><button class="b p" data-a="signin">Anmelden</button><button class="b" data-a="signup">Konto erstellen</button></div></div>`

function dash() {
  const n = inq.filter(i => i.status === 'Neu').length, t = inq.filter(i => i.status === 'Termin gebucht').length
  const a = inq.length - n, q = inq.length ? Math.round(a / inq.length * 100) : 0
  return `<div class="g"><div class="card s"><span>Anfragen gesamt</span><b>${inq.length}</b></div>
<div class="card s"><span>Neu (offen)</span><b>${n}</b></div><div class="card s"><span>Termine gebucht</span><b>${t}</b></div>
<div class="card s"><span>Antwortquote</span><b>${q}%</b></div><div class="card s"><span>Gerettet (geschätzt)</span><b>${t * biz.avg_value} €</b></div></div>
<div class="card"><h2>Letzte Anfragen</h2>${inq.slice(0, 5).map(i => `<div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd)"><span><b>${esc(i.name)}</b> <span class="m">${fmt(i.created_at)}</span></span><span class="pill">${i.status}</span></div>`).join('') || '<p class="m">Noch keine Anfragen.</p>'}</div>`
}

const list = () => `<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:8px"><h2 style="margin:0">Anfragen</h2><button class="b p" data-a="form">Testanfrage</button></div>
<div class="sc"><table><tr><th>Datum</th><th>Kontakt</th><th>Nachricht</th><th>Status</th><th></th></tr>${inq.map(i => `<tr><td>${fmt(i.created_at)}</td>
<td><b>${esc(i.name)}</b><br><span class="m">${esc(i.email)}${i.phone ? ' · ' + esc(i.phone) : ''}</span></td><td>${esc(i.message)}</td>
<td><select data-k="st" data-id="${i.id}" style="margin:0">${ST.map(s => `<option${s === i.status ? ' selected' : ''}>${s}</option>`).join('')}</select></td>
<td><button class="b" data-a="view" data-id="${i.id}">Antwort</button> <button class="b d" data-a="del" data-id="${i.id}">✕</button></td></tr>`).join('')}</table></div>
${inq.length ? '' : '<p class="m">Noch keine Anfragen.</p>'}</div>`

const sets = () => `<div class="card"><h2>Einstellungen</h2>
<label>Betriebsname</label><input data-k="name" value="${esc(biz.name)}">
<label>Buchungslink (z. B. Cal.com)</label><input data-k="booking_link" value="${esc(biz.booking_link)}">
<label>Durchschnittlicher Auftragswert in €</label><input data-k="avg_value" type="number" value="${esc(biz.avg_value)}">
<label>Text der Sofort-Antwort ({name} {betrieb} {link})</label><textarea data-k="reply_template">${esc(biz.reply_template)}</textarea>
<label>Deine Webhook-URL für das Kontaktformular (n8n)</label><p><code>${esc(import.meta.env.VITE_N8N_WEBHOOK || 'https://DEIN-N8N/webhook/anfrage')}?business_id=${biz.id}</code></p></div>`

const plan = () => `<div class="card"><h2>Abo</h2><p>${biz.plan === 'trial' ? `Testphase: noch <b>${daysLeft()} Tage</b> kostenlos.` : `Aktiver Plan: <b>${esc(biz.plan)}</b>`}</p>
<div class="pl"><div class="card"><b>Starter</b><div class="pr">49 €<span class="m"> / Monat</span></div><p class="m">Sofort-Antwort, Buchungslink, Dashboard, 1 Standort</p><button class="b p" data-a="buy" data-p="STARTER">Starter wählen</button></div>
<div class="card"><b>Pro</b><div class="pr">99 €<span class="m"> / Monat</span></div><p class="m">Plus Erinnerungen, Bewertungsbitten, mehrere Standorte</p><button class="b p" data-a="buy" data-p="PRO">Pro wählen</button></div></div></div>`

const mod = () => !modal ? '' : modal.t === 'form'
  ? `<div class="mo"><div class="card"><h2>Testanfrage</h2><label>Name</label><input id="fn"><label>E-Mail</label><input id="fe" type="email"><label>Telefon</label><input id="fp"><label>Nachricht</label><textarea id="fm" style="min-height:80px"></textarea><div class="row"><button class="b p" data-a="send">Senden</button><button class="b" data-a="close">Abbrechen</button></div></div></div>`
  : `<div class="mo"><div class="card"><h2>Sofort-Antwort (Vorschau)</h2><p class="m">An: ${esc(modal.i.email)}</p><pre>${esc(fill(biz.reply_template, modal.i))}</pre><button class="b p" data-a="close">Schließen</button></div></div>`

function render() {
  if (!user) { app.innerHTML = authView(); return }
  if (!biz) { app.innerHTML = '<p>Lade …</p>'; return }
  const T = [['dash', 'Dashboard'], ['list', 'Anfragen'], ['set', 'Einstellungen'], ['plan', 'Abo']]
  const v = { dash, list, set: sets, plan }[tab]()
  app.innerHTML = `<header><span class="logo">📬 AnfragenPilot</span><nav>${T.map(x => `<button class="t${tab === x[0] ? ' on' : ''}" data-a="tab" data-p="${x[0]}">${x[1]}</button>`).join('')}</nav><button class="b" data-a="out">Abmelden</button></header>${v}${mod()}${toast ? `<div class="toast">${esc(toast)}</div>` : ''}`
}

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]'); if (!el) return
  const a = el.dataset.a, id = el.dataset.id
  if (a === 'signin' || a === 'signup') {
    const email = document.getElementById('em').value.trim(), password = document.getElementById('pw').value
    const r = a === 'signin' ? await sb.auth.signInWithPassword({ email, password }) : await sb.auth.signUp({ email, password })
    if (r.error) return alert(r.error.message)
    if (!r.data.session) return alert('Bitte bestätige zuerst deine E-Mail oder schalte "Confirm email" in Supabase aus.')
  } else if (a === 'out') await sb.auth.signOut()
  else if (a === 'tab') { tab = el.dataset.p; render() }
  else if (a === 'form') { modal = { t: 'form' }; render() }
  else if (a === 'close') { modal = null; render() }
  else if (a === 'send') {
    const name = document.getElementById('fn').value.trim(), email = document.getElementById('fe').value.trim()
    if (!name || !email.includes('@')) return say('Name und gültige E-Mail nötig.')
    const { data, error } = await sb.from('inquiries').insert({ business_id: biz.id, name, email, phone: document.getElementById('fp').value, message: document.getElementById('fm').value }).select().single()
    if (error) return alert(error.message)
    inq.unshift(data); modal = { t: 'rep', i: data }; tab = 'list'; render()
  } else if (a === 'view') { modal = { t: 'rep', i: inq.find(x => x.id === id) }; render() }
  else if (a === 'del') { await sb.from('inquiries').delete().eq('id', id); inq = inq.filter(x => x.id !== id); render() }
  else if (a === 'buy') {
    const link = import.meta.env['VITE_STRIPE_' + el.dataset.p]
    if (!link) return say('Stripe-Link fehlt in der .env-Datei.')
    window.open(`${link}?client_reference_id=${user.id}&prefilled_email=${encodeURIComponent(user.email)}`, '_blank', 'noopener')
  }
})

document.addEventListener('change', async e => {
  const k = e.target.dataset.k; if (!k) return
  if (k === 'st') {
    const i = inq.find(x => x.id === e.target.dataset.id); i.status = e.target.value
    await sb.from('inquiries').update({ status: i.status }).eq('id', i.id); render()
  } else {
    biz[k] = k === 'avg_value' ? Number(e.target.value) || 0 : e.target.value
    const { error } = await sb.from('businesses').update({ [k]: biz[k] }).eq('id', biz.id)
    say(error ? 'Fehler beim Speichern' : 'Gespeichert')
  }
})

sb.auth.onAuthStateChange(async (_ev, session) => {
  user = session?.user || null; biz = null
  render()
  if (user) { await load(); render() }
})
render()
