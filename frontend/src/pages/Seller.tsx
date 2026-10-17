import { Mic, Sparkles, Square } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Empty, ErrorState, Loading, Notice } from '@/components/States'
import { ImageUpload, OrderSettingsEditor, ThemeEditor } from '@/components/StoreEditors'
import { StoreBanner } from '@/components/StoreBanner'
import { Badge, statusTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { DEFAULT_ORDER_SETTINGS, DEFAULT_THEME, themeStyle } from '@/lib/theme'
import { cn, formatMoney, formatTime, rupeesToMinor } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import type { Draft, Order, Product, Review, Store, Summary } from '@/lib/types'
import { OrderActions, OrderMeta, statusLabel } from './Orders'

const TABS = ['Overview', 'Listings', 'Orders', 'Store', 'Reviews'] as const
type Tab = (typeof TABS)[number]

function StoreForm({ store, onSaved }: { store?: Store; onSaved: () => void }) {
  const { refresh } = useAuth()
  const [f, setF] = useState({
    name: store?.name ?? '', description: store?.description ?? '', category: store?.category ?? 'food',
    tagline: store?.tagline ?? '', announcement: store?.announcement ?? '',
    operating_hours: store?.operating_hours ?? '', pickup_details: store?.pickup_details ?? '',
    logo_url: store?.logo_url ?? null, banner_url: store?.banner_url ?? null, is_open: store?.is_open ?? true,
    theme: { ...DEFAULT_THEME, ...store?.theme },
    order_settings: { ...DEFAULT_ORDER_SETTINGS, ...store?.order_settings },
  })
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api(store ? `/api/stores/${store.id}` : '/api/stores', { method: store ? 'PATCH' : 'POST', body: f })
      await refresh()
      setMsg({ tone: 'ok', text: 'Saved. Your store page is updated.' })
      onSaved()
    } catch (err) {
      setMsg({ tone: 'bad', text: err instanceof Error ? err.message : 'Save failed' })
    }
  }
  const section = 'space-y-3 rounded-2xl border border-line bg-card p-5'
  return (
    <form onSubmit={save} className="space-y-5">
      <section className={section}>
        <h3 className="text-lg font-bold">Basics</h3>
        <Field label="Store name"><Input required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Tagline" hint="One line under your name."><Input maxLength={120} value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} placeholder="Wok-fresh fried rice, every lunch" /></Field>
        <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Announcement banner" hint="Shown at the top of your store page: offers, closures, news."><Input maxLength={300} value={f.announcement} onChange={(e) => setF({ ...f, announcement: e.target.value })} placeholder="Exam week special: free cutlery and a cold drink with every combo" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Store['category'] })}>{['food', 'printing', 'handmade', 'goods', 'services'].map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Operating hours"><Input value={f.operating_hours} onChange={(e) => setF({ ...f, operating_hours: e.target.value })} placeholder="Mon–Fri 10:00–18:00" /></Field>
        </div>
        <Field label="Pickup details"><Input value={f.pickup_details} onChange={(e) => setF({ ...f, pickup_details: e.target.value })} placeholder="Hostel B gate, 5–7 pm" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_open} onChange={(e) => setF({ ...f, is_open: e.target.checked })} /> Open for orders</label>
      </section>
      <section className={section}>
        <h3 className="text-lg font-bold">Look and feel</h3>
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <ImageUpload label="Logo" value={f.logo_url} onChange={(u) => setF({ ...f, logo_url: u })} previewClass="h-24 w-24" />
          <ImageUpload label="Cover banner (wide photo works best)" value={f.banner_url} onChange={(u) => setF({ ...f, banner_url: u })} previewClass="h-24 w-64" />
        </div>
        <ThemeEditor value={f.theme} onChange={(t) => setF({ ...f, theme: t })} store={{ name: f.name, logo_url: f.logo_url, banner_url: f.banner_url, tagline: f.tagline }} />
      </section>
      <section className={section}>
        <h3 className="text-lg font-bold">Ordering rules</h3>
        <p className="text-sm text-taupe">Everything buyers see at checkout comes from here.</p>
        <OrderSettingsEditor value={f.order_settings} onChange={(s) => setF({ ...f, order_settings: s })} />
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg">{store ? 'Save changes' : 'Create store'}</Button>
        {store && <Link className="text-sm text-terracotta underline" to={`/stores/${store.id}`}>View store page</Link>}
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </form>
  )
}

function Dictation({ onText }: { onText: (t: string) => void }) {
  const rec = useRef<MediaRecorder | null>(null)
  const [recording, setRecording] = useState(false)
  const [msg, setMsg] = useState('')
  if (typeof MediaRecorder === 'undefined') return <p className="text-xs text-taupe">Voice input is not supported in this browser. Type instead.</p>
  const toggle = async () => {
    if (recording) { rec.current?.stop(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: Blob[] = []
      const r = new MediaRecorder(stream)
      rec.current = r
      r.ondataavailable = (e) => chunks.push(e.data)
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
        const form = new FormData()
        form.append('audio', new Blob(chunks, { type: r.mimeType }), 'dictation.webm')
        try {
          const out = await api<{ transcript: string }>('/api/ai/transcribe', { method: 'POST', form })
          onText(out.transcript)
          setMsg('Transcript added. Please check it before generating a draft.')
        } catch (e) {
          setMsg(e instanceof Error ? e.message : 'Transcription failed. Type your listing instead.')
        }
      }
      r.start()
      setRecording(true)
      setMsg('')
    } catch {
      setMsg('Microphone unavailable. Type your listing instead.')
    }
  }
  return (
    <div>
      <Button type="button" variant="secondary" size="sm" onClick={toggle} aria-pressed={recording}>
        {recording ? <><Square className="h-4 w-4" aria-hidden /> Stop</> : <><Mic className="h-4 w-4" aria-hidden /> Dictate</>}
      </Button>
      {msg && <p role="status" className="mt-1 text-xs text-taupe">{msg}</p>}
    </div>
  )
}

function ListingForm({ store, onSaved }: { store: Store; onSaved: () => void }) {
  const empty = { title: '', description: '', kind: 'product', listing_type: 'new', category: 'general', price: '', stock: '', prep: '' }
  const [f, setF] = useState(empty)
  const [image, setImage] = useState<string | null>(null)
  const [aiText, setAiText] = useState('')
  const [ai, setAi] = useState<{ warnings: string[]; missing: string[] } | null>(null)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const draft = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const r = await api<Draft>('/api/ai/listing-draft', { method: 'POST', body: { text: aiText } })
      const d = r.draft
      setF({
        title: d.title ?? '', description: d.description ?? '', kind: d.kind ?? 'product', listing_type: d.listing_type,
        category: d.category ?? 'general', price: d.price_minor !== null ? String(d.price_minor / 100) : '',
        stock: d.stock !== null ? String(d.stock) : '', prep: d.prep_time_min !== null ? String(d.prep_time_min) : '',
      })
      setAi({ warnings: r.warnings, missing: r.missing_fields })
    } catch (e) {
      setMsg({ tone: 'bad', text: e instanceof Error ? e.message : 'The assistant is unavailable. Fill in the form manually.' })
    } finally {
      setBusy(false)
    }
  }
  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api(`/api/stores/${store.id}/products`, {
        method: 'POST',
        body: {
          title: f.title, description: f.description, kind: f.kind, listing_type: f.listing_type, category: f.category || 'general',
          price_minor: rupeesToMinor(f.price), stock: f.stock === '' ? null : Number(f.stock), prep_time_min: Number(f.prep || 0),
          image_urls: image ? [image] : [],
        },
      })
      setMsg({ tone: 'ok', text: 'Saved as a draft. Publish it from the list when you are ready.' })
      setF(empty)
      setImage(null)
      setAi(null)
      onSaved()
    } catch (err) {
      setMsg({ tone: 'bad', text: err instanceof Error ? err.message : 'Save failed' })
    }
  }
  return (
    <Card className="space-y-4">
      <h3 className="text-lg font-bold">New listing</h3>
      <div className="space-y-2 rounded-xl bg-ivory p-3">
        <Field label="Describe it in your own words (optional AI assist)" hint="The assistant only fills fields you state. It never publishes, and it never invents prices or stock.">
          <Textarea value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="e.g. selling 10 homemade brownies for 40 rupees each, ready in 30 min" />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Dictation onText={setAiText} />
          <Button type="button" variant="secondary" size="sm" disabled={busy || aiText.trim().length < 3} onClick={draft}><Sparkles className="h-4 w-4" aria-hidden /> {busy ? 'Working…' : 'Draft with AI'}</Button>
        </div>
        {ai && (
          <div className="space-y-1 text-sm">
            {ai.warnings.map((w) => <p key={w} className="text-warn">{w}</p>)}
            {ai.missing.length > 0 && <p className="text-bad">Please fill in: {ai.missing.join(', ')}</p>}
            <p className="text-taupe">Review everything below, then save. Nothing is published yet.</p>
          </div>
        )}
      </div>
      <form onSubmit={save} className="space-y-3">
        <Field label="Title"><Input required minLength={2} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Type"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="product">Product</option><option value="service">Service</option><option value="printing">Printing (manual quote)</option></Select></Field>
          <Field label="Listing"><Select value={f.listing_type} onChange={(e) => setF({ ...f, listing_type: e.target.value })}>{['new', 'secondhand', 'rent', 'lend', 'exchange'].map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Category"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
          <Field label="Price (₹)"><Input required type="number" min={0} step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
          <Field label="Stock" hint="Leave empty for unlimited"><Input type="number" min={0} value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} /></Field>
          <Field label="Prep time (min)"><Input type="number" min={0} value={f.prep} onChange={(e) => setF({ ...f, prep: e.target.value })} /></Field>
        </div>
        <ImageUpload label="Photo" value={image} onChange={setImage} previewClass="h-24 w-24" />
        <Button type="submit">Save draft</Button>
      </form>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </Card>
  )
}

function Listings({ store }: { store: Store }) {
  const { data, loading, error, reload } = useFetch<Product[]>(`/api/stores/${store.id}/products`, { include_drafts: true })
  const [err, setErr] = useState('')
  const call = async (path: string, method = 'POST', body?: unknown) => {
    setErr('')
    try { await api(path, { method, body }); await reload() } catch (e) { setErr(e instanceof Error ? e.message : 'Failed') }
  }
  const uploadPhoto = async (id: string, file?: File) => {
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    setErr('')
    try {
      const r = await api<{ url: string }>('/api/uploads', { method: 'POST', form })
      await call(`/api/products/${id}`, 'PATCH', { image_urls: [r.url] })
    } catch (e) { setErr(e instanceof Error ? e.message : 'Upload failed') }
  }
  return (
    <div className="space-y-6">
      <ListingForm store={store} onSaved={reload} />
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? <Empty title="No listings yet" /> : (
        <ul className="space-y-2">
          {data.map((p) => (
            <li key={p.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-ivory">{p.image_urls[0] && <img src={p.image_urls[0]} alt="" className="h-full w-full object-cover" />}</div>
                  <div>
                  <p className="font-semibold">{p.title} <Badge tone={p.published ? 'ok' : 'neutral'}>{p.published ? 'Published' : 'Draft'}</Badge> {p.moderation_status === 'removed' && <Badge tone="bad">Removed by moderators</Badge>}</p>
                  <p className="text-sm text-taupe">{formatMoney(p.price_from_minor)} · {p.stock === null && !p.variants.length ? 'unlimited stock' : `stock ${p.variants.length ? p.variants.map((v) => `${v.name}: ${v.stock ?? '∞'}`).join(', ') : p.stock}`}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="cursor-pointer rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-semibold text-forest hover:bg-ivory">
                    {p.image_urls[0] ? 'Change photo' : 'Add photo'}
                    <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={(e) => void uploadPhoto(p.id, e.target.files?.[0])} />
                  </label>
                  {p.variants.length === 0 && p.stock !== null && (
                    <label className="text-xs">Stock<Input type="number" min={0} className="ml-1 inline-block w-20" defaultValue={p.stock} onBlur={(e) => void call(`/api/products/${p.id}`, 'PATCH', { stock: Number(e.target.value) })} /></label>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => call(`/api/products/${p.id}`, 'PATCH', { available: !p.available })}>{p.available ? 'Mark unavailable' : 'Mark available'}</Button>
                  <Button size="sm" variant={p.published ? 'secondary' : 'primary'} onClick={() => call(`/api/products/${p.id}/${p.published ? 'unpublish' : 'publish'}`)}>{p.published ? 'Unpublish' : 'Publish'}</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {err && <Notice tone="bad">{err}</Notice>}
    </div>
  )
}

function Overview() {
  const { data, loading, error, reload } = useFetch<Summary>('/api/seller/summary')
  const [token, setToken] = useState('')
  if (loading) return <Loading />
  if (error || !data) return <ErrorState message={error ?? 'Failed'} onRetry={reload} />
  const make = async () => setToken((await api<{ token: string }>('/api/seller/api-tokens', { method: 'POST' })).token)
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><p className="text-sm text-taupe">Today</p><p className="text-2xl font-extrabold">{formatMoney(data.today.revenue_minor)}</p><p className="text-sm">{data.today.orders_completed} completed</p></Card>
        <Card><p className="text-sm text-taupe">Last 30 days</p><p className="text-2xl font-extrabold">{formatMoney(data.last_30_days.revenue_minor)}</p><p className="text-sm">{data.last_30_days.orders_completed} completed</p></Card>
        <Card><p className="text-sm text-taupe">Open orders</p><p className="text-2xl font-extrabold">{['placed', 'quote_requested', 'quoted', 'accepted', 'preparing', 'ready'].reduce((n, s) => n + (data.orders_by_status[s] ?? 0), 0)}</p></Card>
      </div>
      <Card>
        <h3 className="mb-2 font-bold">Low stock</h3>
        {data.low_stock.length ? <ul className="text-sm">{data.low_stock.map((l, i) => <li key={i}>{l.title}{l.variant ? ` / ${l.variant}` : ''}: <strong>{l.stock}</strong> left</li>)}</ul> : <p className="text-sm text-taupe">Nothing running low.</p>}
      </Card>
      <Card className="space-y-2">
        <h3 className="font-bold">UNO Q assistant token</h3>
        <p className="text-sm text-taupe">Read-only token for your Arduino UNO Q service. It can view your orders and stock, nothing else. It is shown once.</p>
        <Button variant="secondary" onClick={make}>Create token</Button>
        {token && <p className="break-all rounded bg-ivory p-2 font-mono text-xs">{token}</p>}
      </Card>
    </div>
  )
}

function SellerOrders() {
  const { data, loading, error, reload, setData } = useFetch<Order[]>('/api/seller/orders')
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data?.length) return <Empty title="No orders yet" />
  return (
    <ul className="space-y-3">
      {data.map((o) => (
        <li key={o.id}>
          <Card className="space-y-2">
            <div className="flex items-center justify-between">
              <Link to={`/orders/${o.id}`} className="font-semibold underline">{o.buyer_name} · {formatTime(o.created_at)}</Link>
              <Badge tone={statusTone(o.status)}>{statusLabel(o.status)}</Badge>
            </div>
            <p className="text-sm">{o.items.map((l) => `${l.quantity}× ${l.title}${l.variant_name ? ` (${l.variant_name})` : ''}`).join(', ')} · {o.total_minor ? formatMoney(o.total_minor) : 'needs quote'}</p>
            <OrderMeta order={o} />
            <OrderActions order={o} role="seller" onChange={(n) => setData((data ?? []).map((x) => (x.id === n.id ? n : x)))} />
          </Card>
        </li>
      ))}
    </ul>
  )
}

export default function Seller() {
  const { user } = useAuth()
  const stores = useFetch<Store[]>(user?.roles.includes('seller') ? '/api/stores/mine' : null)
  const [tab, setTab] = useState<Tab>('Overview')
  const [idx, setIdx] = useState(0)
  const store = stores.data?.[idx]
  const reviews = useFetch<Review[]>(store && tab === 'Reviews' ? `/api/stores/${store.id}/reviews` : null)

  if (!user) return <Empty title="Log in to open a store"><Button asChild><Link to="/login" state={{ from: '/seller' }}>Log in</Link></Button></Empty>
  if (stores.loading) return <Loading />
  if (!store) return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-extrabold">Open your store</h1>
      <p className="text-taupe">Tell students what you offer. You can add listings right after.</p>
      <Card><StoreForm onSaved={() => void stores.reload()} /></Card>
    </div>
  )
  return (
    <div className="space-y-6" style={themeStyle(store.theme)}>
      <StoreBanner store={store} height="h-32 sm:h-44">
        <div className="flex flex-wrap items-center gap-2 pt-3">
          <Badge tone={store.is_open ? 'ok' : 'neutral'}>{store.is_open ? 'Open for orders' : 'Closed'}</Badge>
          <Button asChild variant="secondary" size="sm"><Link to={`/stores/${store.id}`}>View store page</Link></Button>
          <Button size="sm" onClick={() => setTab('Store')}>Edit look and rules</Button>
        </div>
      </StoreBanner>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">Seller Studio</h2>
        {stores.data && stores.data.length > 1 && <Select aria-label="Choose store" className="w-48" value={idx} onChange={(e) => setIdx(Number(e.target.value))}>{stores.data.map((s, i) => <option key={s.id} value={i}>{s.name}</option>)}</Select>}
      </div>
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('rounded-t-lg px-4 py-2 text-sm font-semibold', tab === t ? 'bg-forest text-white' : 'text-forest hover:bg-forest/10')}>{t}</button>)}
        <Link className="ml-auto px-3 py-2 text-sm text-terracotta underline" to="/inbox">Messages</Link>
      </div>
      {tab === 'Overview' && <Overview />}
      {tab === 'Listings' && <Listings store={store} />}
      {tab === 'Orders' && <SellerOrders />}
      {tab === 'Store' && <StoreForm key={store.id} store={store} onSaved={() => void stores.reload()} />}
      {tab === 'Reviews' && (reviews.loading ? <Loading /> : reviews.data?.length ? <ul className="space-y-2">{reviews.data.map((r) => <li key={r.id}><Card>{'★'.repeat(r.rating)} <span className="sr-only">{r.rating} out of 5</span> {r.comment} <span className="text-sm text-taupe">by {r.buyer_name}</span></Card></li>)}</ul> : <Empty title="No reviews yet" />)}
    </div>
  )
}
