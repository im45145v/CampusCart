import { Mic, Sparkles, Square } from 'lucide-react'
import { useCallback, useRef, useState, type FormEvent } from 'react'
import { RevenueChart, StatusChart } from '@/components/Charts'
import { PlanEditor } from '@/components/Memberships'
import { VoucherDesk } from '@/components/Vouchers'
import { ReviewCard } from '@/components/Reviews'
import { Link, useSearchParams } from 'react-router-dom'
import { Empty, ErrorState, Loading, Notice } from '@/components/States'
import { ImageUpload, OrderSettingsEditor, ThemeEditor } from '@/components/StoreEditors'
import { StoreBanner } from '@/components/StoreBanner'
import { Badge, statusTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useLiveOrders } from '@/lib/live'
import { DEFAULT_ORDER_SETTINGS, DEFAULT_THEME, themeStyle } from '@/lib/theme'
import { cn, formatMoney, formatTime, rupeesToMinor } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import { STORE_CATEGORIES, type Draft, type Order, type Plan, type Product, type Review, type SellerCharts, type Store, type Subscription, type Summary, type Voucher } from '@/lib/types'
import { OrderActions, OrderMeta, printSummary, slotText, statusLabel } from './Orders'

const TABS = ['Overview', 'Listings', 'Orders', 'Plans', 'Offers', 'Store', 'Reviews'] as const
type Tab = (typeof TABS)[number]

const SAMPLE_LISTING_NOTE = 'Garlic fried rice, 90 rupees, 12 portions, ready in 15 minutes, hostel pickup'

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
      setMsg({ tone: 'ok', text: store ? 'Saved. Your store page is updated.' : 'Submitted. An admin has to approve the store before students can see it. You can add listings while you wait.' })
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
          <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Store['category'] })}>{STORE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
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
        <OrderSettingsEditor value={f.order_settings} onChange={(s) => setF({ ...f, order_settings: s })} />
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg">{store ? 'Save changes' : 'Submit for approval'}</Button>
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

function formFromDraft(r: Draft) {
  const d = r.draft
  return {
    title: d.title ?? '', description: d.description ?? '', kind: d.kind ?? 'product', listing_type: d.listing_type,
    category: d.category ?? 'general', price: d.price_minor !== null ? String(d.price_minor / 100) : '',
    stock: d.stock !== null ? String(d.stock) : '', prep: d.prep_time_min !== null ? String(d.prep_time_min) : '',
    rate_unit: 'day' as 'day' | 'hour', max_units: '',
  }
}

function ListingForm({ store, onSaved, incoming }: {
  store: Store
  onSaved: () => void
  incoming: Draft | null
}) {
  const empty = { title: '', description: '', kind: 'product', listing_type: store.category === 'lending' ? 'lend' : 'new', category: 'general', price: '', stock: '', prep: '', rate_unit: 'day' as 'day' | 'hour', max_units: '' }
  const [f, setF] = useState(() => (incoming ? formFromDraft(incoming) : empty))
  const [extras, setExtras] = useState([{ name: '', price: '', max: '1' }])
  const [rates, setRates] = useState({ bw: '1', color: '5', a3: '2', staple: '5', spiral: '20', urgent: '25', copies: '20' })
  const [image, setImage] = useState<string | null>(null)
  const [ai] = useState<{ warnings: string[]; missing: string[] } | null>(
    () => (incoming ? { warnings: incoming.warnings, missing: incoming.missing_fields } : null),
  )
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api(`/api/stores/${store.id}/products`, {
        method: 'POST',
        body: {
          title: f.title, description: f.description, kind: f.kind, listing_type: f.listing_type, category: f.category || 'general',
          price_minor: f.kind === 'printing' ? rupeesToMinor(rates.bw) : rupeesToMinor(f.price),
          ...((f.listing_type === 'lend' || f.listing_type === 'rent') ? { rate_unit: f.rate_unit, max_units: Math.max(1, Math.min(336, Number(f.max_units) || 1)) } : {}),
          stock: f.kind === 'printing' || f.stock === '' ? null : Number(f.stock), prep_time_min: Number(f.prep || 0),
          image_urls: image ? [image] : [],
          addons: f.kind === 'printing' ? [] : extras.filter((e) => e.name.trim()).map((e) => ({
            name: e.name.trim(), price_minor: rupeesToMinor(e.price), max_qty: Math.max(1, Math.min(10, Number(e.max) || 1)),
          })),
          ...(f.kind === 'printing' ? { print_spec: {
            bw_per_page_minor: rupeesToMinor(rates.bw), color_per_page_minor: rupeesToMinor(rates.color),
            papers: [{ id: 'a4', label: 'A4', extra_per_sheet_minor: 0 }, { id: 'a3', label: 'A3', extra_per_sheet_minor: rupeesToMinor(rates.a3) }],
            bindings: [{ id: 'none', label: 'No binding', price_minor: 0 }, { id: 'staple', label: 'Staples', price_minor: rupeesToMinor(rates.staple) }, { id: 'spiral', label: 'Spiral', price_minor: rupeesToMinor(rates.spiral) }],
            allow_duplex: true, urgent_percent: Math.max(0, Math.min(100, Number(rates.urgent) || 0)), max_copies: Math.max(1, Math.min(100, Number(rates.copies) || 20)),
          } } : {}),
        },
      })
      setMsg({ tone: 'ok', text: 'Saved as a draft. Publish it from the list when you are ready.' })
      setF(empty)
      setExtras([{ name: '', price: '', max: '1' }])
      setImage(null)
      onSaved()
    } catch (err) {
      setMsg({ tone: 'bad', text: err instanceof Error ? err.message : 'Save failed' })
    }
  }
  return (
    <Card className="space-y-4">
      <h3 className="text-lg font-bold">New listing</h3>
      {ai && (ai.warnings.length > 0 || ai.missing.length > 0) && (
        <div className="space-y-1 text-sm">
          {ai.warnings.map((w) => <p key={w} className="text-warn">{w}</p>)}
          {ai.missing.length > 0 && <p className="text-bad">Still needed: {ai.missing.join(', ')}</p>}
        </div>
      )}
      <form onSubmit={save} className="space-y-3">
        <Field label="Title"><Input required minLength={2} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Type"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="product">Product</option><option value="service">Service</option><option value="printing">Printing (priced from the file)</option></Select></Field>
          <Field label="Listing"><Select value={f.listing_type} onChange={(e) => setF({ ...f, listing_type: e.target.value })}>{['new', 'secondhand', 'rent', 'lend', 'exchange'].map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Category"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
          {f.kind !== 'printing' && <Field label={(f.listing_type === 'lend' || f.listing_type === 'rent') ? `₹ per ${f.rate_unit}` : 'Price (₹)'}><Input required type="number" min={0} step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>}
          {(f.listing_type === 'lend' || f.listing_type === 'rent') && <>
            <Field label="Charge"><Select value={f.rate_unit} onChange={(e) => setF({ ...f, rate_unit: e.target.value as 'day' | 'hour' })}><option value="day">Per day</option><option value="hour">Per hour</option></Select></Field>
            <Field label={f.rate_unit === 'hour' ? 'Longest borrow (hours)' : 'Longest borrow (days)'}><Input required type="number" min={1} max={336} value={f.max_units} onChange={(e) => setF({ ...f, max_units: e.target.value })} /></Field>
          </>}
          <Field label="Stock" hint="Leave empty for unlimited"><Input type="number" min={0} value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} /></Field>
          <Field label="Prep time (min)"><Input type="number" min={0} value={f.prep} onChange={(e) => setF({ ...f, prep: e.target.value })} /></Field>
        </div>
        {f.kind === 'printing' ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Black and white ₹ / page"><Input type="number" min={0} step="0.01" value={rates.bw} onChange={(e) => setRates({ ...rates, bw: e.target.value })} /></Field>
            <Field label="Colour ₹ / page"><Input type="number" min={0} step="0.01" value={rates.color} onChange={(e) => setRates({ ...rates, color: e.target.value })} /></Field>
            <Field label="A3 extra ₹ / sheet"><Input type="number" min={0} step="0.01" value={rates.a3} onChange={(e) => setRates({ ...rates, a3: e.target.value })} /></Field>
            <Field label="Staples ₹ / copy"><Input type="number" min={0} step="0.01" value={rates.staple} onChange={(e) => setRates({ ...rates, staple: e.target.value })} /></Field>
            <Field label="Spiral ₹ / copy"><Input type="number" min={0} step="0.01" value={rates.spiral} onChange={(e) => setRates({ ...rates, spiral: e.target.value })} /></Field>
            <Field label="Urgent percent"><Input type="number" min={0} max={100} value={rates.urgent} onChange={(e) => setRates({ ...rates, urgent: e.target.value })} /></Field>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-forest">Extras, such as a fried egg</p>
            {extras.map((extra, i) => (
              <div key={i} className="grid grid-cols-[1fr_7rem_5rem] gap-2">
                <Input aria-label="Extra name" placeholder="Fried egg" value={extra.name} onChange={(e) => setExtras(extras.map((row, n) => n === i ? { ...row, name: e.target.value } : row))} />
                <Input aria-label="Extra price in rupees" type="number" min={0} step="0.01" placeholder="₹" value={extra.price} onChange={(e) => setExtras(extras.map((row, n) => n === i ? { ...row, price: e.target.value } : row))} />
                <Input aria-label="Maximum quantity" type="number" min={1} max={10} value={extra.max} onChange={(e) => setExtras(extras.map((row, n) => n === i ? { ...row, max: e.target.value } : row))} />
              </div>
            ))}
            {extras.length < 8 && <Button type="button" variant="secondary" size="sm" onClick={() => setExtras([...extras, { name: '', price: '', max: '1' }])}>Add an extra</Button>}
          </div>
        )}
        <ImageUpload label="Photo" value={image} onChange={setImage} previewClass="h-24 w-24" />
        <Button type="submit">Save draft</Button>
      </form>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </Card>
  )
}

function Listings({ store, incoming, formKey, onDrafted }: { store: Store; incoming: Draft | null; formKey: number; onDrafted: (draft: Draft) => void }) {
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
      <GemmaStudioBar onDrafted={onDrafted} />
      <ListingForm key={formKey} store={store} onSaved={reload} incoming={incoming} />
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? <Empty title="No listings yet" /> : (
        <ul className="space-y-2">
          {data.map((p) => (
            <li key={p.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-ivory">{p.image_urls[0] && <img src={p.image_urls[0]} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}</div>
                  <div>
                  <p className="font-semibold">{p.title} <Badge tone={p.published ? 'ok' : 'neutral'}>{p.published ? 'Published' : 'Draft'}</Badge> {p.featured && <Badge tone="warn">Featured</Badge>} {p.moderation_status === 'removed' && <Badge tone="bad">Removed by moderators</Badge>}</p>
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
                  <Button variant="secondary" size="sm" onClick={() => call(`/api/products/${p.id}`, 'PATCH', { featured: !p.featured })}>{p.featured ? 'Remove from home' : 'Feature on home'}</Button>
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
  const charts = useFetch<SellerCharts>('/api/seller/charts')
  if (loading) return <Loading />
  if (error || !data) return <ErrorState message={error ?? 'Failed'} onRetry={reload} />
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><p className="text-sm text-taupe">Today</p><p className="text-2xl font-extrabold">{formatMoney(data.today.revenue_minor)}</p><p className="text-sm">{data.today.orders_completed} completed</p></Card>
        <Card><p className="text-sm text-taupe">Last 30 days</p><p className="text-2xl font-extrabold">{formatMoney(data.last_30_days.revenue_minor)}</p><p className="text-sm">{data.last_30_days.orders_completed} completed</p></Card>
        <Card><p className="text-sm text-taupe">Open orders</p><p className="text-2xl font-extrabold">{['placed', 'quote_requested', 'quoted', 'accepted', 'preparing', 'ready'].reduce((n, s) => n + (data.orders_by_status[s] ?? 0), 0)}</p></Card>
      </div>
      {charts.data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><RevenueChart days={charts.data.days} /></Card>
          <Card><StatusChart byStatus={charts.data.by_status} /></Card>
        </div>
      )}
      <Card>
        <h3 className="mb-2 font-bold">Low stock</h3>
        {data.low_stock.length ? <ul className="text-sm">{data.low_stock.map((l, i) => <li key={i}>{l.title}{l.variant ? ` / ${l.variant}` : ''}: <strong>{l.stock}</strong> left</li>)}</ul> : <p className="text-sm text-taupe">Nothing running low.</p>}
      </Card>
    </div>
  )
}

const CLOSED = new Set(['completed', 'rejected', 'cancelled'])

function packetName(order: Order): string {
  const named = order.answers?.find((a) => a.id === 'packet' || /packet/i.test(a.label))
  return named?.value.trim() || order.buyer_name
}

function lineText(order: Order): string {
  return order.items.map((l) => `${l.quantity}× ${l.title}${l.variant_name ? ` (${l.variant_name})` : ''}`).join(', ')
}

function answerValue(order: Order, id: string): string {
  return order.answers?.find((a) => a.id === id)?.value.trim() ?? ''
}

function SellerOrders({ printing, lending }: { printing: boolean; lending: boolean }) {
  const { data, loading, error, reload, setData } = useFetch<Order[]>('/api/seller/orders')
  const apply = useCallback((order: Order) => {
    setData((cur) => {
      if (!cur) return cur
      if (!cur.some((x) => x.id === order.id)) return [order, ...cur]
      return cur.map((x) => (x.id === order.id ? order : x))
    })
  }, [setData])
  useLiveOrders(apply)
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data?.length) return <Empty title={printing ? 'No print jobs yet' : lending ? 'Nothing is out on loan' : 'No orders yet'} />
  const replace = (n: Order) => setData((data ?? []).map((x) => (x.id === n.id ? n : x)))
  if (lending) {
    const ranked = [...data].sort((a, b) => {
      const closed = Number(CLOSED.has(a.status)) - Number(CLOSED.has(b.status))
      if (closed) return closed
      const slotA = a.pickup_slot ? `${a.pickup_slot.date} ${a.pickup_slot.label}` : '9'
      const slotB = b.pickup_slot ? `${b.pickup_slot.date} ${b.pickup_slot.label}` : '9'
      return slotA.localeCompare(slotB) || a.created_at.localeCompare(b.created_at)
    })
    const open = ranked.filter((o) => !CLOSED.has(o.status))
    const done = ranked.filter((o) => CLOSED.has(o.status))
    const loan = (o: Order) => {
      const due = answerValue(o, 'return_by')
      const where = answerValue(o, 'use_where')
      return (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-taupe">Who has it</p>
              <p className="text-2xl font-extrabold leading-tight">{o.buyer_name}</p>
              <p className="text-sm text-taupe">{formatTime(o.created_at)}</p>
            </div>
            <Badge tone={statusTone(o.status)}>{statusLabel(o.status)}</Badge>
          </div>
          <p className="font-semibold">{lineText(o)}</p>
          {due && <p className="text-sm font-semibold text-forest">Back by {due}</p>}
          {where && <p className="text-sm">Using it at {where}</p>}
          {o.pickup_slot && <p className="text-sm">Hand over {slotText(o.pickup_slot)}</p>}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold">{o.total_minor ? `${formatMoney(o.total_minor)} fee` : 'Needs a quote'}</span>
            <Link className="text-terracotta underline" to={`/orders/${o.id}`}>Full order</Link>
          </div>
          <OrderActions order={o} role="seller" onChange={replace} />
        </Card>
      )
    }
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-extrabold">Out on loan</h3>
          <p className="text-sm text-taupe">The next handover comes first. Accept the borrow, hand it over, then mark it back when they return it.</p>
        </div>
        {open.length ? <ul className="space-y-3">{open.map((o) => <li key={o.id}>{loan(o)}</li>)}</ul> : <p className="text-sm text-taupe">Nothing is out right now.</p>}
        {done.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-semibold">Returned or cancelled ({done.length})</summary>
            <ul className="mt-3 space-y-3">{done.map((o) => <li key={o.id}>{loan(o)}</li>)}</ul>
          </details>
        )}
      </div>
    )
  }
  if (!printing) {
    return (
      <ul className="space-y-3">
        {data.map((o) => (
          <li key={o.id}>
            <Card className="space-y-2">
              <div className="flex items-center justify-between">
                <Link to={`/orders/${o.id}`} className="font-semibold underline">{o.buyer_name} · {formatTime(o.created_at)}</Link>
                <Badge tone={statusTone(o.status)}>{statusLabel(o.status)}</Badge>
              </div>
              <p className="text-sm">{lineText(o)} · {o.total_minor ? formatMoney(o.total_minor) : 'needs quote'}</p>
              <OrderMeta order={o} />
              <OrderActions order={o} role="seller" onChange={replace} />
            </Card>
          </li>
        ))}
      </ul>
    )
  }
  const ranked = [...data].sort((a, b) => {
    const closed = Number(CLOSED.has(a.status)) - Number(CLOSED.has(b.status))
    if (closed) return closed
    const urgent = Number(!a.items.some((l) => l.print?.urgent)) - Number(!b.items.some((l) => l.print?.urgent))
    if (urgent) return urgent
    const slotA = a.pickup_slot ? `${a.pickup_slot.date} ${a.pickup_slot.label}` : '9'
    const slotB = b.pickup_slot ? `${b.pickup_slot.date} ${b.pickup_slot.label}` : '9'
    return slotA.localeCompare(slotB) || a.created_at.localeCompare(b.created_at)
  })
  const open = ranked.filter((o) => !CLOSED.has(o.status))
  const done = ranked.filter((o) => CLOSED.has(o.status))
  const ticket = (o: Order) => {
    const jobs = o.items.filter((l) => l.print)
    return (
      <Card className={cn('space-y-3', jobs.some((l) => l.print?.urgent) && !CLOSED.has(o.status) && 'border-terracotta')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-taupe">Name on the packet</p>
            <p className="text-2xl font-extrabold leading-tight">{packetName(o)}</p>
            <p className="text-sm text-taupe">{o.buyer_name} · {formatTime(o.created_at)}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {jobs.some((l) => l.print?.urgent) && <Badge tone="bad">Urgent</Badge>}
            <Badge tone={statusTone(o.status)}>{statusLabel(o.status)}</Badge>
          </div>
        </div>
        {jobs.length ? jobs.map((l) => {
          const job = l.print
          if (!job) return null
          return (
            <div key={job.file_url} className="space-y-2">
              <p className="font-semibold">{printSummary(job)}</p>
              {job.note && <p className="text-sm">Note: {job.note}</p>}
              <Button asChild size="sm"><a href={job.file_url} target="_blank" rel="noreferrer">Open the file</a></Button>
            </div>
          )
        }) : <p className="text-sm">{lineText(o)}</p>}
        {o.pickup_slot && <p className="text-sm font-semibold text-forest">Collect {slotText(o.pickup_slot)}</p>}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold">{o.total_minor ? formatMoney(o.total_minor) : 'Needs a quote'}</span>
          <Link className="text-terracotta underline" to={`/orders/${o.id}`}>Full order</Link>
        </div>
        <OrderActions order={o} role="seller" onChange={replace} />
      </Card>
    )
  }
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-extrabold">Jobs to print</h3>
        <p className="text-sm text-taupe">Urgent jobs come first, then the next pickup slot. Write the packet name on the stack, open the file, then mark the job.</p>
      </div>
      {open.length ? <ul className="space-y-3">{open.map((o) => <li key={o.id}>{ticket(o)}</li>)}</ul> : <p className="text-sm text-taupe">Nothing waiting on the desk.</p>}
      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Finished ({done.length})</summary>
          <ul className="mt-3 space-y-3">{done.map((o) => <li key={o.id}>{ticket(o)}</li>)}</ul>
        </details>
      )}
    </div>
  )
}

function GemmaStudioBar({ onDrafted }: { onDrafted: (draft: Draft) => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const run = async (note: string) => {
    setText(note)
    setBusy(true)
    setMsg(null)
    try {
      onDrafted(await api<Draft>('/api/ai/listing-draft', { method: 'POST', body: { text: note } }))
      setMsg({ tone: 'ok', text: 'Draft is in the listing form. Check it, then save.' })
    } catch (e) {
      setMsg({ tone: 'bad', text: e instanceof Error ? e.message : 'The assistant is unavailable. Fill in the listing form manually.' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-card p-5" aria-labelledby="gemma-draft">
      <div>
        <h2 id="gemma-draft" className="text-lg font-bold">Draft with Gemma 4</h2>
        <p className="mt-1 text-sm text-taupe">Say the price and the stock. The draft stays here until you save it.</p>
      </div>
      <Field label="Describe the listing in your own words">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE_LISTING_NOTE} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void run(SAMPLE_LISTING_NOTE)}>Run the sample note</Button>
        <Dictation onText={setText} />
        <Button type="button" size="sm" disabled={busy || text.trim().length < 3} onClick={() => void run(text)}>
          <Sparkles className="h-4 w-4" aria-hidden /> {busy ? 'Working…' : 'Draft with Gemma 4'}
        </Button>
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </section>
  )
}

export default function Seller() {
  const { user } = useAuth()
  const stores = useFetch<Store[]>(user ? '/api/stores/mine' : null)
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: Tab = (TABS as readonly string[]).includes(requested ?? '') ? requested as Tab : 'Overview'
  const setTab = (next: Tab) => {
    const copy = new URLSearchParams(params)
    if (next === 'Overview') copy.delete('tab')
    else copy.set('tab', next)
    setParams(copy, { replace: true })
  }
  const [incoming, setIncoming] = useState<Draft | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [idx, setIdx] = useState(0)
  const store = stores.data?.[idx]
  const reviews = useFetch<Review[]>(store && tab === 'Reviews' ? `/api/stores/${store.id}/reviews` : null)
  const plans = useFetch<Plan[]>(store && tab === 'Plans' ? `/api/stores/${store.id}/plans` : null)
  const members = useFetch<Subscription[]>(store && tab === 'Plans' ? `/api/stores/${store.id}/subscribers` : null)
  const vouchers = useFetch<Voucher[]>(store && tab === 'Offers' ? `/api/stores/${store.id}/vouchers` : null, { include_paused: true })

  if (!user) return <Empty title="Log in to open a store"><Button asChild><Link to="/login" state={{ from: '/seller' }}>Log in</Link></Button></Empty>
  if (stores.loading) return <Loading />
  if (!store) return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-extrabold">Apply to open a store</h1>
      <p className="text-taupe">Tell students what you offer. An admin reviews the application before the store appears on campus. You can prepare listings while you wait.</p>
      <Card><StoreForm onSaved={() => void stores.reload()} /></Card>
    </div>
  )
  return (
    <div className="space-y-6" style={themeStyle(store.theme)}>
      <StoreBanner store={store} height="h-32 sm:h-44">
        <div className="flex flex-wrap items-center gap-2 pt-3">
          <Badge tone={store.status === 'active' ? (store.is_open ? 'ok' : 'neutral') : statusTone(store.status)}>
            {store.status === 'active' ? (store.is_open ? 'Open for orders' : 'Closed') : store.status === 'pending' ? 'Waiting for approval' : store.status === 'rejected' ? 'Not approved' : store.status}
          </Badge>
          <Button asChild variant="secondary" size="sm"><Link to={`/stores/${store.id}`}>View store page</Link></Button>
          <Button size="sm" onClick={() => setTab('Store')}>Edit look and rules</Button>
        </div>
      </StoreBanner>
      {store.status === 'pending' && <Notice tone="ok">This store is waiting for an admin. Students cannot see it or order yet.</Notice>}
      {store.status === 'rejected' && (
        <div className="space-y-2">
          <Notice tone="bad">An admin did not approve this store{store.review_reason ? `: ${store.review_reason}` : ''}. Update it, then submit again.</Notice>
          <Button size="sm" onClick={async () => { await api(`/api/stores/${store.id}/resubmit`, { method: 'POST' }); await stores.reload() }}>Submit again</Button>
        </div>
      )}
      {stores.data && stores.data.length > 1 && <Select aria-label="Choose store" className="w-48" value={idx} onChange={(e) => setIdx(Number(e.target.value))}>{stores.data.map((s, i) => <option key={s.id} value={i}>{s.name}</option>)}</Select>}
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('rounded-t-lg px-4 py-2 text-sm font-semibold', tab === t ? 'bg-forest text-white' : 'text-forest hover:bg-forest/10')}>{t === 'Orders' && store.category === 'printing' ? 'Print queue' : t === 'Orders' && store.category === 'lending' ? 'Loans' : t}</button>)}
        <Link className="ml-auto px-3 py-2 text-sm text-terracotta underline" to="/inbox">Messages</Link>
      </div>
      {tab === 'Overview' && <Overview />}
      {tab === 'Listings' && <Listings store={store} incoming={incoming} formKey={formKey} onDrafted={(draft) => { setIncoming(draft); setFormKey((n) => n + 1); setTab('Listings') }} />}
      {tab === 'Orders' && <SellerOrders printing={store.category === 'printing'} lending={store.category === 'lending'} />}
      {tab === 'Plans' && (plans.loading ? <Loading /> : (
        <div className="space-y-4">
          <PlanEditor storeId={store.id} plans={plans.data ?? []} onSaved={() => void plans.reload()} />
          <Card>
            <h3 className="mb-2 font-bold">Members</h3>
            {members.data?.length ? <ul className="space-y-1 text-sm">{members.data.map((m) => <li key={m.id}>{m.buyer_name} · {m.title} · {m.status} until {new Date(m.period_end).toLocaleDateString()}</li>)}</ul> : <p className="text-sm text-taupe">No one has subscribed yet.</p>}
          </Card>
        </div>
      ))}
      {tab === 'Offers' && (vouchers.loading ? <Loading /> : (
        <VoucherDesk createUrl={`/api/stores/${store.id}/vouchers`} vouchers={vouchers.data ?? []} onSaved={() => void vouchers.reload()} />
      ))}
      {tab === 'Store' && <StoreForm key={store.id} store={store} onSaved={() => void stores.reload()} />}
      {tab === 'Reviews' && (reviews.loading ? <Loading /> : reviews.data?.length ? <ul className="space-y-2">{reviews.data.map((r) => <li key={r.id}><ReviewCard review={r} canReply onReplied={() => void reviews.reload()} /></li>)}</ul> : <Empty title="No reviews yet" />)}
    </div>
  )
}
