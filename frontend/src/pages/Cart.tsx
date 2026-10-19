import { Clock, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, Loading, Notice } from '@/components/States'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { borrowUnits, groupByStore, lineEstimate, lineKey, type CartLine } from '@/lib/cart'
import { openPaymentPage } from '@/lib/payment'
import { useCart } from '@/lib/cartContext'
import { themeStyle } from '@/lib/theme'
import { cn, formatMoney, paysUpfront } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import type { Order, OrderOptions, Store, VoucherQuote, Wallet } from '@/lib/types'

const FULFILMENT_LABEL = { pickup: 'Pickup at the store', campus_meetup: 'Campus meetup' }
const PAYMENT_LABEL = {
  pay_on_pickup: 'Pay on pickup',
  manual_confirmation: 'Pay seller directly (seller confirms)',
  campus_wallet: 'Campus wallet (credits you loaded in the app)',
}

function SlotPicker({ opts, value, onChange }: { opts: OrderOptions; value: string; onChange: (v: string) => void }) {
  const open = opts.days.find((d) => d.slots.some((s) => s.available))?.date ?? opts.days[0]?.date ?? ''
  const [day, setDay] = useState(value.split('|')[0] || open)
  const current = opts.days.find((d) => d.date === day)
  const pickDay = (next: string) => {
    setDay(next)
    onChange('')
  }
  return (
    <fieldset className="space-y-2">
      <Field label={`Collect on${opts.slot_required ? '' : ' (optional)'}`}>
        <Input type="date" min={opts.days[0]?.date} max={opts.days[opts.days.length - 1]?.date} value={day} onChange={(e) => pickDay(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        {current?.slots.map((s) => {
          const key = `${current.date}|${s.label}`
          return (
            <button key={key} type="button" disabled={!s.available} aria-pressed={value === key} onClick={() => onChange(value === key ? '' : key)}
              className={cn('min-h-11 rounded-xl border px-3 py-2 text-sm transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40', value === key ? 'border-terracotta bg-terracotta text-on-primary' : 'border-line bg-white hover:bg-mist')}>
              {s.label.replace('-', ' to ')}
              {s.remaining !== null && s.available && <span className="ml-1 text-xs opacity-80">({s.remaining} left)</span>}
              {!s.available && <span className="ml-1 text-xs">{s.remaining === 0 ? '(full)' : '(passed)'}</span>}
            </button>
          )
        })}
        {day && !current && <p className="text-sm text-warn">That day is not open.</p>}
      </div>
    </fieldset>
  )
}

function StoreCheckout({ storeId, lines }: { storeId: string; lines: CartLine[] }) {
  const cart = useCart()
  const toast = useToast()
  const { user } = useAuth()
  const nav = useNavigate()
  const store = useFetch<Store>(`/api/stores/${storeId}`)
  const options = useFetch<OrderOptions>(`/api/stores/${storeId}/order-options`)
  const wallet = useFetch<Wallet>(user ? '/api/me/wallet' : null)
  const [fulfillmentPick, setFulfillment] = useState('')
  const [paymentPick, setPayment] = useState('')
  const [slot, setSlot] = useState('')
  const [returnOn, setReturnOn] = useState('')
  const [returnTime, setReturnTime] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [offer, setOffer] = useState<VoucherQuote | null>(null)
  const [codeError, setCodeError] = useState('')
  const opts = options.data

  const fulfillment = opts && opts.fulfillment_options.includes(fulfillmentPick as never) ? fulfillmentPick : opts?.fulfillment_options[0] ?? 'pickup'
  const payment = opts && opts.payment_options.includes(paymentPick as never) ? paymentPick : opts?.payment_options[0] ?? 'pay_on_pickup'
  const maxQty = opts?.max_qty_per_item ?? 99
  const rated = lines.some((l) => l.rateUnit === 'day' || l.rateUnit === 'hour')
  const hourly = lines.some((l) => l.rateUnit === 'hour')
  const collectOn = slot.split('|')[0] ?? ''
  const slotLabel = slot.split('|')[1] ?? ''
  const answered = { ...answers }
  if (returnOn && opts?.custom_fields.some((f) => f.id === 'return_by')) answered.return_by = returnOn
  const missing = opts?.custom_fields.filter((f) => f.required && f.id !== 'return_by' && (answered[f.id] ?? '') === '') ?? []
  const slotMissing = !!opts?.slots_enabled && opts.slot_required && !slot
  const returnMissing = rated && !returnOn
  const timeMissing = hourly && !!returnOn && !returnTime
  const charges = lines.map((l) => {
    if (!l.rateUnit) return { units: 1, error: '' }
    return borrowUnits({ unit: l.rateUnit, collectOn, returnOn, slotLabel, returnTime, maxUnits: l.maxUnits })
  })
  const rateError = charges.find((c) => c.error)?.error ?? ''
  const estimate = lines.reduce((sum, l, i) => sum + lineEstimate(l, l.rateUnit ? charges[i].units : 1), 0)
  const payable = offer?.payable_minor ?? estimate
  const balance = wallet.data?.balance_minor ?? user?.wallet_balance_minor ?? 0
  const payThisOrder = payment === 'campus_wallet' && payable > balance && wallet.data?.checkout === 'ready'
  const itemBody = lines.map((l) => ({
    product_id: l.productId, variant_id: l.variantId, quantity: l.quantity,
    addons: (l.addons ?? []).map((a) => ({ id: a.id, quantity: a.quantity })),
    ...(l.printJob ? { print_job: {
      file_url: l.printJob.fileUrl, color: l.printJob.color, paper_id: l.printJob.paperId,
      sides: l.printJob.sides, binding_id: l.printJob.bindingId, copies: l.printJob.copies,
      urgent: l.printJob.urgent, note: l.printJob.note,
    } } : {}),
  }))

  const checkCode = async () => {
    if (!user) return nav('/login', { state: { from: '/cart' } })
    setCodeError('')
    setOffer(null)
    try {
      const [date, label] = slot.split('|')
      setOffer(await api<VoucherQuote>('/api/vouchers/preview', {
        method: 'POST', body: {
          store_id: storeId, code, payment_method: payment, items: itemBody,
          ...(slot ? { pickup_slot: { date, label } } : {}),
          ...(returnOn ? { return_on: returnOn } : {}),
          ...(returnTime ? { return_time: returnTime } : {}),
        },
      }))
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : 'That code does not apply')
    }
  }

  const place = async () => {
    if (!user) return nav('/login', { state: { from: '/cart' } })
    setBusy(true)
    setError('')
    const popup = payThisOrder ? window.open('', '_blank') : null
    try {
      const [date, label] = slot.split('|')
      const order = await api<Order>('/api/orders', {
        method: 'POST',
        body: {
          store_id: storeId, fulfillment, payment_method: payment, note, request_details: details,
          ...(code.trim() ? { voucher_code: code.trim() } : {}),
          ...(slot ? { pickup_slot: { date, label } } : {}),
          ...(returnOn ? { return_on: returnOn } : {}),
          ...(returnTime ? { return_time: returnTime } : {}),
          answers: answered,
          items: itemBody,
        },
      })
      cart.removeStore(storeId)
      if (order.checkout_url) {
        const opened = openPaymentPage(order.checkout_url, popup)
        if (!opened) popup?.close()
        if (popup && !popup.closed) nav(`/orders/${order.id}`)
        return
      }
      popup?.close()
      nav(`/orders/${order.id}`)
    } catch (e) {
      popup?.close()
      const message = e instanceof Error ? e.message : 'Could not place order'
      setError(message)
      toast('bad', message)
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
        {lines.map((l, i) => (
          <li key={lineKey(l)} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{l.title}</p>
              {l.variantName && <p className="text-sm text-taupe">{l.variantName}</p>}
              {l.addons?.map((a) => <p key={a.id} className="text-sm text-taupe">{a.quantity} × {a.name} (+{formatMoney(a.priceMinor)})</p>)}
              {l.printJob && <p className="text-sm text-taupe">{l.printJob.pages} pages · {l.printJob.copies} copies · {l.printJob.paperLabel} · {l.printJob.color === 'color' ? 'colour' : 'black and white'} · {l.printJob.bindingLabel}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!l.printJob && <><label className="sr-only" htmlFor={`q-${lineKey(l)}`}>Quantity for {l.title}</label>
              <Input id={`q-${lineKey(l)}`} type="number" min={1} max={maxQty} className="w-20" value={l.quantity} onChange={(e) => cart.setQty(lineKey(l), Math.min(maxQty, Number(e.target.value) || 1))} /></>}
              <span className="w-28 text-right text-sm">
                {l.rateUnit && charges[i].units > 0
                  ? `${formatMoney(l.unitPriceMinor)} / ${l.rateUnit} × ${charges[i].units}`
                  : l.rateUnit ? `${formatMoney(l.unitPriceMinor)} / ${l.rateUnit}` : formatMoney(lineEstimate(l))}
              </span>
              <Button variant="ghost" size="sm" className="h-11 w-11" aria-label={`Remove ${l.title}`} onClick={() => cart.setQty(lineKey(l), 0)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
            </div>
          </li>
        ))}
      </ul>
      {maxQty < 99 && <p className="text-xs text-taupe">This store allows up to {maxQty} of each item.</p>}
      {opts && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fulfilment"><Select value={fulfillment} onChange={(e) => setFulfillment(e.target.value)}>{opts.fulfillment_options.map((o) => <option key={o} value={o}>{FULFILMENT_LABEL[o]}</option>)}</Select></Field>
            {paysUpfront(opts.payment_options) ? (
              <p className="text-sm sm:col-span-2">Pay upfront with campus credits. This stall does not take cash when you collect. The credits leave your balance when you place the order, and come back if the order is cancelled or rejected. If the wallet does not cover this order, you pay that amount with UPI instead. It is only for this order.</p>
            ) : (
              <Field label="Payment" hint="Campus credits, or cash the seller confirms. This is not a bank payment.">
                <Select value={payment} onChange={(e) => setPayment(e.target.value)}>{opts.payment_options.map((o) => <option key={o} value={o}>{PAYMENT_LABEL[o]}</option>)}</Select>
              </Field>
            )}
          </div>
          {opts.slots_enabled && <SlotPicker opts={opts} value={slot} onChange={setSlot} />}
          {rated && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Bring it back on *" hint="The fee is the listing rate for each day or hour, and it stops at the longest borrow on that listing.">
                <Input type="date" required min={collectOn || undefined} value={returnOn} onChange={(e) => setReturnOn(e.target.value)} />
              </Field>
              {hourly && <Field label="Bring it back at *"><Input type="time" required value={returnTime} onChange={(e) => setReturnTime(e.target.value)} /></Field>}
            </div>
          )}
          {opts.custom_fields.filter((f) => !(rated && f.id === 'return_by')).map((f) => (
            <div key={f.id}>
              {f.type === 'date' ? (
                <Field label={`${f.label}${f.required ? ' *' : ''}`}><Input type="date" value={answers[f.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })} /></Field>
              ) : f.type === 'checkbox' ? (
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
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Promo code">
          <Input value={code} maxLength={16} className="uppercase" onChange={(e) => { setCode(e.target.value); setOffer(null); setCodeError('') }} placeholder="FIRSTBITE" />
        </Field>
        <Button type="button" variant="secondary" disabled={!code.trim()} onClick={() => void checkCode()}>Check code</Button>
      </div>
      {offer && <Notice tone="ok">{offer.message} {offer.membership_discount_minor > 0 ? `Membership already took ${formatMoney(offer.membership_discount_minor)}.` : ''} You pay {formatMoney(offer.payable_minor)}.</Notice>}
      {codeError && <Notice tone="bad">{codeError}</Notice>}
      <Field label="Note to seller (optional)"><Input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} /></Field>
      {lines.some((l) => l.printJob) && <Field label="Note for the print desk (optional)"><Textarea value={details} maxLength={3000} onChange={(e) => setDetails(e.target.value)} /></Field>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>Total <strong>{formatMoney(payable)}</strong></p>
        <Button size="lg" disabled={busy || !opts || slotMissing || missing.length > 0 || returnMissing || timeMissing || !!rateError} onClick={place}>{busy ? 'Placing…' : payThisOrder ? 'Pay this order with UPI' : 'Place order'}</Button>
      </div>
      {slotMissing && <p className="text-sm text-warn">Choose a pickup time to continue.</p>}
      {returnMissing && <p className="text-sm text-warn">Choose the day you will bring it back.</p>}
      {timeMissing && <p className="text-sm text-warn">Choose the time you will bring it back.</p>}
      {rateError && <p className="text-sm text-warn">{rateError}</p>}
      {missing.length > 0 && <p className="text-sm text-warn">Please answer: {missing.map((m) => m.label).join(', ')}</p>}
      {options.error && <Notice tone="bad">{options.error}</Notice>}
      {payThisOrder && <p className="text-sm text-taupe">Campus credits ({formatMoney(balance)}) do not cover this order. UPI pays {formatMoney(payable)} for this order only. It is not added to your wallet.</p>}
      {error && <Notice tone="bad">{error}</Notice>}
    </Card>
    </div>
  )
}

export default function Cart() {
  const { lines } = useCart()
  const groups = groupByStore(lines)
  if (lines.length === 0) return <Empty title="Your cart is empty"><Button asChild><Link to="/browse">Browse the stalls</Link></Button></Empty>
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Cart</h1>
      <p className="text-sm text-taupe">Review each stall, then place the order. Payment follows that stall’s rules.</p>
      {groups.size > 1 && <p className="text-sm text-taupe">Each stall gets its own order.</p>}
      {[...groups].map(([storeId, ls]) => <StoreCheckout key={storeId} storeId={storeId} lines={ls} />)}
    </div>
  )
}
