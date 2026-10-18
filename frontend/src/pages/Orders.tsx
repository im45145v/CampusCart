import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ReviewCard, ReviewForm } from '@/components/Reviews'
import { MessageButton, ReportButton } from '@/components/ContactButtons'
import { Empty, ErrorState, Loading, Notice } from '@/components/States'
import { Badge, statusTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useLiveOrders } from '@/lib/live'
import { formatMoney, formatTime, rupeesToMinor } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import type { Order, OrderLine, Review } from '@/lib/types'

const PAYMENT: Record<string, string> = {
  pay_on_pickup: 'Pay on pickup',
  manual_confirmation: 'Paid directly to the seller',
  campus_wallet: 'Campus wallet',
}
const PAY_STATUS: Record<string, string> = {
  unpaid: 'not yet confirmed by the seller',
  confirmed_by_seller: 'confirmed by the seller',
  wallet_paid: 'paid from the campus wallet',
}

export const statusLabel = (s: string) => s.replace('_', ' ')

export function slotText(slot: NonNullable<Order['pickup_slot']>): string {
  const day = new Date(`${slot.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  return `${day}, ${slot.label.replace('-', ' to ')}`
}

export function OrderMeta({ order }: { order: Order }) {
  const open = !['completed', 'rejected', 'cancelled'].includes(order.status)
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {order.pickup_slot && <Badge tone="ok">Pickup {slotText(order.pickup_slot)}</Badge>}
      {open && !order.pickup_slot && !!order.est_wait_min && <Badge>About {order.est_wait_min} min wait</Badge>}
      {order.answers?.map((a) => <span key={a.id} className="rounded-full bg-ivory px-2 py-0.5 text-forest">{a.label}: {a.value}</span>)}
    </div>
  )
}

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
              <div><p className="font-semibold">{o.store_name}</p><p className="text-sm text-taupe">{formatTime(o.created_at)} · {o.items.length} item(s)</p><OrderMeta order={o} /></div>
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
const PRINT_ACTION_LABEL: Record<string, string> = {
  accepted: 'Take the job', preparing: 'Start printing', ready: 'Packet is ready', completed: 'Handed over', cancelled: 'Cancel job',
}
const LEND_ACTION_LABEL: Record<string, string> = {
  accepted: 'Accept the borrow', preparing: 'Ready to collect', ready: 'They collected it',
  completed: 'Back on the shelf', rejected: 'Cannot lend', cancelled: 'Cancel borrow',
}

export function printSummary(job: NonNullable<OrderLine['print']>): string {
  return [
    `${job.copies} ${job.copies === 1 ? 'copy' : 'copies'}`,
    `${job.pages} ${job.pages === 1 ? 'page' : 'pages'}`,
    job.color === 'color' ? 'Colour' : 'Black and white',
    job.paper,
    job.sides === 'duplex' ? 'Double sided' : 'Single sided',
    job.binding,
  ].join(' · ')
}

export function OrderActions({ order, role, onChange }: { order: Order; role: 'buyer' | 'seller'; onChange: (o: Order) => void }) {
  const [error, setError] = useState('')
  const [quote, setQuote] = useState('')
  const next = (role === 'seller' ? SELLER_NEXT : BUYER_NEXT)[order.status] ?? []
  const printing = role === 'seller' && order.items.some((line) => line.print)
  const lending = role === 'seller' && order.items.some((line) => line.listing_type === 'lend')
  const actionLabel = (status: string) => {
    if (role === 'buyer' && status === 'accepted') return 'Approve quote'
    if (printing && PRINT_ACTION_LABEL[status]) return PRINT_ACTION_LABEL[status]
    if (lending && LEND_ACTION_LABEL[status]) return LEND_ACTION_LABEL[status]
    return ACTION_LABEL[status]
  }
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
        {next.map((s) => <Button key={s} variant={s === 'rejected' || s === 'cancelled' ? 'secondary' : 'primary'} onClick={() => act(s)}>{actionLabel(s)}</Button>)}
        {role === 'seller' && order.payment_status === 'unpaid' && !['rejected', 'cancelled'].includes(order.status) && <Button variant="secondary" onClick={confirmPayment}>I received payment</Button>}
      </div>
      {role === 'seller' && ['quote_requested', 'quoted'].includes(order.status) && (
        <div className="flex items-end gap-2"><Field label="Quote total (₹)"><Input type="number" min={0} value={quote} onChange={(e) => setQuote(e.target.value)} /></Field><Button disabled={!quote} onClick={sendQuote}>Send quote</Button></div>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
    </div>
  )
}

function OrderReview({ orderId, completed }: { orderId: string; completed: boolean }) {
  const review = useFetch<{ review: Review | null }>(`/api/orders/${orderId}/review`)
  if (review.data?.review) return <ReviewCard review={review.data.review} />
  if (!completed) return null
  return <ReviewForm orderId={orderId} onDone={() => void review.reload()} />
}

export function OrderDetail() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const { data, loading, error, reload, setData } = useFetch<Order>(`/api/orders/${id}`)
  const apply = useCallback((order: Order) => { if (order.id === id) setData(order) }, [id, setData])
  const live = useLiveOrders(apply)
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
          {data.items.map((l, i) => (
            <li key={i} className="py-2">
              <div className="flex justify-between gap-3"><span>{l.quantity} × {l.title}{l.variant_name ? ` (${l.variant_name})` : ''}</span><span>{formatMoney(l.line_total_minor)}</span></div>
              {l.addons?.map((a) => <p key={a.id} className="text-sm text-taupe">{a.quantity} × {a.name} (+{formatMoney(a.price_minor)} each)</p>)}
              {l.print && (
                <div className="mt-2 space-y-1 text-sm">
                  <p className="font-semibold text-forest">{printSummary(l.print)}{l.print.urgent ? ' · Urgent' : ''}</p>
                  <p className="text-taupe">{l.print.impressions} impressions {formatMoney(l.print.impression_minor)} · {l.print.sheets} sheets {formatMoney(l.print.paper_minor)} · binding {formatMoney(l.print.binding_minor)}{l.print.urgent ? ` · urgent ${formatMoney(l.print.urgent_minor)}` : ''}</p>
                  {l.print.note && <p>Note: {l.print.note}</p>}
                  <Button asChild size="sm"><a href={l.print.file_url} target="_blank" rel="noreferrer">Open the file</a></Button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {!!data.discount_minor && <p className="text-right text-sm text-forest">Membership discount −{formatMoney(data.discount_minor)}</p>}
        {!!data.voucher_discount_minor && <p className="text-right text-sm text-forest">Code {data.voucher_code} −{formatMoney(data.voucher_discount_minor)}</p>}
        <p className="text-right text-lg font-bold">{data.total_minor ? formatMoney(data.total_minor) : `Awaiting quote (estimate ${formatMoney(data.estimated_minor)})`}</p>
        <p className="text-sm text-taupe">{data.fulfillment === 'pickup' ? 'Pickup' : 'Campus meetup'} · {PAYMENT[data.payment_method] ?? data.payment_method} · Payment {PAY_STATUS[data.payment_status] ?? data.payment_status}</p>
        {live === 'online' && <p className="text-xs text-forest">Live updates are on.</p>}
        {role === 'seller' && <p className="text-sm">Buyer: {data.buyer_name}</p>}
        {data.pickup_slot && <p className="text-sm font-semibold text-forest">Pickup slot: {slotText(data.pickup_slot)}</p>}
        {!!data.est_wait_min && !['completed', 'rejected', 'cancelled'].includes(data.status) && <p className="text-sm">Estimated wait when placed: about {data.est_wait_min} min</p>}
        {data.answers?.map((a) => <p key={a.id} className="text-sm"><span className="text-taupe">{a.label}:</span> {a.value}</p>)}
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
      {role === 'buyer' && <OrderReview orderId={data.id} completed={data.status === 'completed'} />}
    </div>
  )
}
