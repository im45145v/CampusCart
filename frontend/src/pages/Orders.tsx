import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MessageButton, ReportButton } from '@/components/ContactButtons'
import { Empty, ErrorState, Loading, Notice } from '@/components/States'
import { Badge, statusTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatMoney, formatTime, rupeesToMinor } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import type { Order } from '@/lib/types'

export const statusLabel = (s: string) => s.replace('_', ' ')

export function OrderList() {
  const { data, loading, error, reload } = useFetch<Order[]>('/api/orders')
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data?.length) return <Empty title="No orders yet"><Button asChild><Link to="/browse">Start shopping</Link></Button></Empty>
  return (
    <ul className="space-y-3">
      {data.map((o) => (
        <li key={o.id}>
          <Link to={`/orders/${o.id}`}>
            <Card className="flex items-center justify-between hover:shadow-md">
              <div><p className="font-semibold">{o.store_name}</p><p className="text-sm text-taupe">{formatTime(o.created_at)} · {o.items.length} item(s)</p></div>
              <div className="text-right"><Badge tone={statusTone(o.status)}>{statusLabel(o.status)}</Badge><p className="mt-1 font-semibold">{o.total_minor ? formatMoney(o.total_minor) : 'Awaiting quote'}</p></div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  )
}

const SELLER_NEXT: Record<string, string[]> = {
  placed: ['accepted', 'rejected'], quote_requested: ['rejected'], quoted: ['rejected'],
  accepted: ['preparing', 'cancelled'], preparing: ['ready', 'cancelled'], ready: ['completed', 'cancelled'],
}
const BUYER_NEXT: Record<string, string[]> = {
  placed: ['cancelled'], quote_requested: ['cancelled'], quoted: ['accepted', 'cancelled'], accepted: ['cancelled'],
}
const ACTION_LABEL: Record<string, string> = {
  accepted: 'Accept', rejected: 'Reject', preparing: 'Start preparing', ready: 'Mark ready', completed: 'Mark completed', cancelled: 'Cancel order',
}

export function OrderActions({ order, role, onChange }: { order: Order; role: 'buyer' | 'seller'; onChange: (o: Order) => void }) {
  const [error, setError] = useState('')
  const [quote, setQuote] = useState('')
  const next = (role === 'seller' ? SELLER_NEXT : BUYER_NEXT)[order.status] ?? []
  const act = async (status: string) => {
    setError('')
    try {
      onChange(await api<Order>(`/api/orders/${order.id}/status`, { method: 'POST', body: { status } }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    }
  }
  const sendQuote = async () => {
    try {
      onChange(await api<Order>(`/api/orders/${order.id}/quote`, { method: 'POST', body: { total_minor: rupeesToMinor(quote) } }))
      setQuote('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    }
  }
  const confirmPayment = async () => onChange(await api<Order>(`/api/orders/${order.id}/confirm-payment`, { method: 'POST' }))
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {next.map((s) => <Button key={s} variant={s === 'rejected' || s === 'cancelled' ? 'secondary' : 'primary'} onClick={() => act(s)}>{role === 'buyer' && s === 'accepted' ? 'Approve quote' : ACTION_LABEL[s]}</Button>)}
        {role === 'seller' && order.payment_status === 'unpaid' && !['rejected', 'cancelled'].includes(order.status) && <Button variant="secondary" onClick={confirmPayment}>I received payment</Button>}
      </div>
      {role === 'seller' && ['quote_requested', 'quoted'].includes(order.status) && (
        <div className="flex items-end gap-2"><Field label="Quote total (₹)"><Input type="number" min={0} value={quote} onChange={(e) => setQuote(e.target.value)} /></Field><Button disabled={!quote} onClick={sendQuote}>Send quote</Button></div>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
    </div>
  )
}

function ReviewForm({ orderId }: { orderId: string }) {
  const [rating, setRating] = useState('5')
  const [comment, setComment] = useState('')
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const submit = async () => {
    try {
      await api(`/api/orders/${orderId}/review`, { method: 'POST', body: { rating: Number(rating), comment } })
      setMsg({ tone: 'ok', text: 'Thanks for your review!' })
    } catch (e) {
      setMsg({ tone: 'bad', text: e instanceof Error ? e.message : 'Failed' })
    }
  }
  return (
    <Card className="space-y-3">
      <h2 className="font-bold">Review this order</h2>
      <Field label="Rating"><Select value={rating} onChange={(e) => setRating(e.target.value)}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}</Select></Field>
      <Field label="Comment"><Input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} /></Field>
      <Button onClick={submit}>Submit review</Button>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </Card>
  )
}

export function OrderDetail() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const { data, loading, error, reload, setData } = useFetch<Order>(`/api/orders/${id}`)
  if (loading) return <Loading />
  if (error || !data) return <ErrorState message={error ?? 'Order not found'} onRetry={reload} />
  const role = data.buyer_id === user?.id ? 'buyer' : 'seller'
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Order from {data.store_name}</h1>
        <Badge tone={statusTone(data.status)} className="text-sm">{statusLabel(data.status)}</Badge>
      </div>
      <Card className="space-y-3">
        <ul className="divide-y divide-line">
          {data.items.map((l, i) => <li key={i} className="flex justify-between py-2"><span>{l.quantity} × {l.title}{l.variant_name ? ` (${l.variant_name})` : ''}</span><span>{formatMoney(l.line_total_minor)}</span></li>)}
        </ul>
        <p className="text-right text-lg font-bold">{data.total_minor ? formatMoney(data.total_minor) : `Awaiting quote (estimate ${formatMoney(data.estimated_minor)})`}</p>
        <p className="text-sm text-taupe">{data.fulfillment === 'pickup' ? 'Pickup' : 'Campus meetup'} · {data.payment_method === 'pay_on_pickup' ? 'Pay on pickup' : 'Paid directly to seller'} · Payment {data.payment_status === 'unpaid' ? 'not yet confirmed by seller' : 'confirmed by seller'}</p>
        {role === 'seller' && <p className="text-sm">Buyer: {data.buyer_name}</p>}
        {data.note && <p className="text-sm">Note: {data.note}</p>}
        {data.request_details && <p className="whitespace-pre-line text-sm">Request: {data.request_details}</p>}
      </Card>
      <OrderActions order={data} role={role} onChange={setData} />
      <Card>
        <h2 className="mb-2 font-bold">Progress</h2>
        <ol className="space-y-1 text-sm">{data.history.map((h, i) => <li key={i}><Badge tone={statusTone(h.status)}>{statusLabel(h.status)}</Badge> <span className="text-taupe">{formatTime(h.at)}</span></li>)}</ol>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <MessageButton storeId={data.store_id} orderId={data.id} label={role === 'buyer' ? 'Message seller' : 'Message buyer'} />
        <ReportButton targetType="order" targetId={data.id} />
      </div>
      {role === 'buyer' && data.status === 'completed' && <ReviewForm orderId={data.id} />}
    </div>
  )
}
