import { Clock, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, Loading, Notice } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { estimateTotal, groupByStore, lineKey, type CartLine } from '@/lib/cart'
import { useCart } from '@/lib/cartContext'
import { themeStyle } from '@/lib/theme'
import { cn, formatMoney } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import type { Order, OrderOptions, Store } from '@/lib/types'

const FULFILMENT_LABEL = { pickup: 'Pickup at the store', campus_meetup: 'Campus meetup' }
const PAYMENT_LABEL = { pay_on_pickup: 'Pay on pickup', manual_confirmation: 'Pay seller directly (seller confirms)' }

function SlotPicker({ opts, value, onChange }: { opts: OrderOptions; value: string; onChange: (v: string) => void }) {
  const [day, setDay] = useState(opts.days.find((d) => d.slots.some((s) => s.available))?.date ?? opts.days[0]?.date)
  const current = opts.days.find((d) => d.date === day)
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-forest">Pickup time {opts.slot_required ? '' : '(optional)'}</legend>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Pickup day">
        {opts.days.map((d, i) => (
          <button key={d.date} type="button" role="tab" aria-selected={d.date === day} onClick={() => setDay(d.date)}
            className={cn('rounded-lg border px-3 py-1.5 text-sm', d.date === day ? 'border-terracotta bg-terracotta text-white' : 'border-line bg-white')}>
            {i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {current?.slots.map((s) => {
          const key = `${current.date}|${s.label}`
          return (
            <button key={key} type="button" disabled={!s.available} aria-pressed={value === key} onClick={() => onChange(value === key ? '' : key)}
              className={cn('rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40', value === key ? 'border-terracotta bg-terracotta text-white' : 'border-line bg-white hover:bg-ivory')}>
              {s.label.replace('-', ' to ')}
              {s.remaining !== null && s.available && <span className="ml-1 text-xs opacity-80">({s.remaining} left)</span>}
              {!s.available && <span className="ml-1 text-xs">{s.remaining === 0 ? '(full)' : '(passed)'}</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function StoreCheckout({ storeId, lines }: { storeId: string; lines: CartLine[] }) {
  const cart = useCart()
  const { user } = useAuth()
  const nav = useNavigate()
  const store = useFetch<Store>(`/api/stores/${storeId}`)
  const options = useFetch<OrderOptions>(`/api/stores/${storeId}/order-options`)
  const [fulfillmentPick, setFulfillment] = useState('')
  const [paymentPick, setPayment] = useState('')
  const [slot, setSlot] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const opts = options.data

  const fulfillment = opts && opts.fulfillment_options.includes(fulfillmentPick as never) ? fulfillmentPick : opts?.fulfillment_options[0] ?? 'pickup'
  const payment = opts && opts.payment_options.includes(paymentPick as never) ? paymentPick : opts?.payment_options[0] ?? 'pay_on_pickup'
  const maxQty = opts?.max_qty_per_item ?? 99
  const missing = opts?.custom_fields.filter((f) => f.required && (answers[f.id] ?? '') === '' ) ?? []
  const slotMissing = !!opts?.slots_enabled && opts.slot_required && !slot
  const estimate = estimateTotal(lines)

  const place = async () => {
    if (!user) return nav('/login', { state: { from: '/cart' } })
    setBusy(true)
    setError('')
    try {
      const [date, label] = slot.split('|')
      const order = await api<Order>('/api/orders', {
        method: 'POST',
        body: {
          store_id: storeId, fulfillment, payment_method: payment, note, request_details: details,
          ...(slot ? { pickup_slot: { date, label } } : {}), answers,
          items: lines.map((l) => ({ product_id: l.productId, variant_id: l.variantId, quantity: l.quantity })),
        },
      })
      cart.removeStore(storeId)
      nav(`/orders/${order.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not place order')
      void options.reload()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div style={themeStyle(store.data?.theme)}>
    <Card className="space-y-4">
      <h2 className="text-lg font-bold">{lines[0].storeName || store.data?.name || 'Store'}</h2>
      {options.loading && !opts && <Loading />}
      {opts?.order_instructions && <Notice tone="ok">{opts.order_instructions}</Notice>}
      <ul className="divide-y divide-line">
        {lines.map((l) => (
          <li key={lineKey(l)} className="flex items-center justify-between gap-3 py-2">
            <div><p className="font-medium">{l.title}</p>{l.variantName && <p className="text-sm text-taupe">{l.variantName}</p>}</div>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor={`q-${lineKey(l)}`}>Quantity for {l.title}</label>
              <Input id={`q-${lineKey(l)}`} type="number" min={1} max={maxQty} className="w-20" value={l.quantity} onChange={(e) => cart.setQty(lineKey(l), Math.min(maxQty, Number(e.target.value) || 1))} />
              <span className="w-24 text-right">{formatMoney(l.unitPriceMinor * l.quantity)}</span>
              <Button variant="ghost" size="sm" aria-label={`Remove ${l.title}`} onClick={() => cart.setQty(lineKey(l), 0)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
            </div>
          </li>
        ))}
      </ul>
      {maxQty < 99 && <p className="text-xs text-taupe">This store allows up to {maxQty} of each item.</p>}
      {opts && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fulfilment"><Select value={fulfillment} onChange={(e) => setFulfillment(e.target.value)}>{opts.fulfillment_options.map((o) => <option key={o} value={o}>{FULFILMENT_LABEL[o]}</option>)}</Select></Field>
            <Field label="Payment" hint="CampusCart does not process or verify payments. You pay the seller directly.">
              <Select value={payment} onChange={(e) => setPayment(e.target.value)}>{opts.payment_options.map((o) => <option key={o} value={o}>{PAYMENT_LABEL[o]}</option>)}</Select>
            </Field>
          </div>
          {opts.slots_enabled && <SlotPicker opts={opts} value={slot} onChange={setSlot} />}
          {opts.custom_fields.map((f) => (
            <div key={f.id}>
              {f.type === 'checkbox' ? (
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={answers[f.id] === 'yes'} onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.checked ? 'yes' : '' })} /> {f.label}{f.required && ' *'}</label>
              ) : f.type === 'select' ? (
                <Field label={`${f.label}${f.required ? ' *' : ''}`}><Select value={answers[f.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })}><option value="">Choose…</option>{f.options.map((o) => <option key={o}>{o}</option>)}</Select></Field>
              ) : (
                <Field label={`${f.label}${f.required ? ' *' : ''}`}><Input maxLength={300} value={answers[f.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })} /></Field>
              )}
            </div>
          ))}
          <p className="flex items-center gap-2 text-sm text-taupe"><Clock className="h-4 w-4" aria-hidden /> {opts.current_wait_min > 0 ? `Current wait is about ${opts.current_wait_min} min, plus preparation time for your items.` : 'No queue right now.'}</p>
          {opts.min_order_minor > 0 && estimate < opts.min_order_minor && <Notice tone="bad">Minimum order is {formatMoney(opts.min_order_minor)}. Printing quotes are exempt.</Notice>}
        </>
      )}
      <Field label="Note to seller (optional)"><Input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} /></Field>
      <Field label="Request details (printing/services)" hint="Printing orders get a manual quote from the seller before anything is charged."><Textarea value={details} maxLength={3000} onChange={(e) => setDetails(e.target.value)} /></Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>Estimated total <strong>{formatMoney(estimate)}</strong> <span className="text-xs text-taupe">(final price is calculated by the server)</span></p>
        <Button size="lg" disabled={busy || !opts || slotMissing || missing.length > 0} onClick={place}>{busy ? 'Placing…' : 'Place order'}</Button>
      </div>
      {slotMissing && <p className="text-sm text-warn">Choose a pickup time to continue.</p>}
      {missing.length > 0 && <p className="text-sm text-warn">Please answer: {missing.map((m) => m.label).join(', ')}</p>}
      {options.error && <Notice tone="bad">{options.error}</Notice>}
      {error && <Notice tone="bad">{error}</Notice>}
    </Card>
    </div>
  )
}

export default function Cart() {
  const { lines } = useCart()
  if (lines.length === 0) return <Empty title="Your cart is empty"><Button asChild><Link to="/browse">Browse the marketplace</Link></Button></Empty>
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Cart & checkout</h1>
      <p className="text-sm text-taupe">Each store receives its own order.</p>
      {[...groupByStore(lines)].map(([storeId, ls]) => <StoreCheckout key={storeId} storeId={storeId} lines={ls} />)}
    </div>
  )
}
