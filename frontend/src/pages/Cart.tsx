import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, Notice } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { estimateTotal, groupByStore, lineKey, type CartLine } from '@/lib/cart'
import { useCart } from '@/lib/cartContext'
import { formatMoney } from '@/lib/utils'
import type { Order } from '@/lib/types'

function StoreCheckout({ storeId, lines }: { storeId: string; lines: CartLine[] }) {
  const cart = useCart()
  const { user } = useAuth()
  const nav = useNavigate()
  const [fulfillment, setFulfillment] = useState('pickup')
  const [payment, setPayment] = useState('pay_on_pickup')
  const [note, setNote] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const place = async () => {
    if (!user) return nav('/login', { state: { from: '/cart' } })
    setBusy(true)
    setError('')
    try {
      const order = await api<Order>('/api/orders', {
        method: 'POST',
        body: {
          store_id: storeId, fulfillment, payment_method: payment, note, request_details: details,
          items: lines.map((l) => ({ product_id: l.productId, variant_id: l.variantId, quantity: l.quantity })),
        },
      })
      cart.removeStore(storeId)
      nav(`/orders/${order.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not place order')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-bold">{lines[0].storeName || 'Store'}</h2>
      <ul className="divide-y divide-line">
        {lines.map((l) => (
          <li key={lineKey(l)} className="flex items-center justify-between gap-3 py-2">
            <div><p className="font-medium">{l.title}</p>{l.variantName && <p className="text-sm text-taupe">{l.variantName}</p>}</div>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor={`q-${lineKey(l)}`}>Quantity for {l.title}</label>
              <Input id={`q-${lineKey(l)}`} type="number" min={1} max={99} className="w-20" value={l.quantity} onChange={(e) => cart.setQty(lineKey(l), Number(e.target.value) || 1)} />
              <span className="w-24 text-right">{formatMoney(l.unitPriceMinor * l.quantity)}</span>
              <Button variant="ghost" size="sm" aria-label={`Remove ${l.title}`} onClick={() => cart.setQty(lineKey(l), 0)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
            </div>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fulfilment"><Select value={fulfillment} onChange={(e) => setFulfillment(e.target.value)}><option value="pickup">Pickup at the store</option><option value="campus_meetup">Campus meetup</option></Select></Field>
        <Field label="Payment" hint="CampusCart does not process or verify payments. You pay the seller directly.">
          <Select value={payment} onChange={(e) => setPayment(e.target.value)}><option value="pay_on_pickup">Pay on pickup</option><option value="manual_confirmation">Pay seller directly (seller confirms)</option></Select>
        </Field>
      </div>
      <Field label="Note to seller (optional)"><Input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} /></Field>
      <Field label="Request details (printing/services)" hint="Printing orders get a manual quote from the seller before anything is charged."><Textarea value={details} maxLength={3000} onChange={(e) => setDetails(e.target.value)} /></Field>
      <div className="flex items-center justify-between">
        <p>Estimated total <strong>{formatMoney(estimateTotal(lines))}</strong> <span className="text-xs text-taupe">(final price is calculated by the server)</span></p>
        <Button size="lg" disabled={busy} onClick={place}>{busy ? 'Placing…' : 'Place order'}</Button>
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
    </Card>
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
