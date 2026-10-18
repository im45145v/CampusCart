import { Clock, Heart, MapPin, Megaphone, ShoppingBag, Star, Timer } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { MessageButton, ReportButton } from '@/components/ContactButtons'
import { ProductCard } from '@/components/Cards'
import { PlanCards } from '@/components/Memberships'
import { OfferList } from '@/components/Vouchers'
import { RatingBars, ReviewCard } from '@/components/Reviews'
import { Empty, ErrorState, Loading } from '@/components/States'
import { StoreBanner } from '@/components/StoreBanner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { themeStyle } from '@/lib/theme'
import { formatMoney } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import type { OrderOptions, Plan, Product, Review, Store, Subscription, Voucher } from '@/lib/types'

export default function StorePage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const store = useFetch<Store>(`/api/stores/${id}`)
  const products = useFetch<Product[]>(`/api/stores/${id}/products`)
  const reviews = useFetch<Review[]>(`/api/stores/${id}/reviews`)
  const plans = useFetch<Plan[]>(`/api/stores/${id}/plans`)
  const offers = useFetch<Voucher[]>(`/api/stores/${id}/vouchers`)
  const subs = useFetch<Subscription[]>(user ? '/api/me/subscriptions' : null)
  const options = useFetch<OrderOptions>(`/api/stores/${id}/order-options`)
  const saved = useFetch<Store[]>(user ? '/api/me/saved-stores' : null)
  const isSaved = saved.data?.some((s) => s.id === id) ?? false

  if (store.loading) return <Loading />
  if (store.error || !store.data) return <ErrorState message={store.error ?? 'Store not found'} />
  const s = store.data
  const o = options.data
  const toggleSave = async () => {
    await api(`/api/me/saved-stores/${id}`, { method: isSaved ? 'DELETE' : 'PUT' })
    void saved.reload()
  }
  return (
    <div className="space-y-8 rounded-3xl bg-ivory p-3 sm:p-5" style={themeStyle(s.theme)}>
      {s.announcement && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-medium text-white"><Megaphone className="h-4 w-4 shrink-0" aria-hidden /> {s.announcement}</p>
      )}
      <StoreBanner store={s}>
        <div className="flex flex-wrap items-center gap-2 pt-3">
          {user && user.id !== s.owner_id && <MessageButton storeId={s.id} />}
          {user && <Button variant="secondary" onClick={toggleSave} aria-pressed={isSaved}><Heart className={`h-4 w-4 ${isSaved ? 'fill-terracotta text-terracotta' : ''}`} aria-hidden /> {isSaved ? 'Saved' : 'Save store'}</Button>}
          <ReportButton targetType="store" targetId={s.id} />
        </div>
      </StoreBanner>
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={s.is_open ? 'ok' : 'neutral'}>{s.is_open ? 'Open now' : 'Closed'}</Badge>
          <Badge>{s.category}</Badge>
          {s.rating_count > 0 && <span className="flex items-center gap-1 text-taupe"><Star className="h-4 w-4 fill-current" aria-hidden /> {s.rating_avg.toFixed(1)} ({s.rating_count} reviews)</span>}
        </div>
        <p className="text-taupe">{s.description}</p>
        {s.operating_hours && <p className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4" aria-hidden /> {s.operating_hours}</p>}
        {s.pickup_details && <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4" aria-hidden /> {s.pickup_details}</p>}
        {o && (
          <ul className="flex flex-wrap gap-2 pt-1 text-xs" aria-label="How ordering works here">
            {o.slots_enabled && <li className="flex items-center gap-1 rounded-full bg-ivory px-3 py-1"><Timer className="h-3 w-3" aria-hidden /> Pick a time slot{o.slot_capacity ? `, ${o.slot_capacity} orders per slot` : ''}</li>}
            {o.current_wait_min > 0 && <li className="flex items-center gap-1 rounded-full bg-ivory px-3 py-1"><Clock className="h-3 w-3" aria-hidden /> About {o.current_wait_min} min wait right now</li>}
            {o.min_order_minor > 0 && <li className="flex items-center gap-1 rounded-full bg-ivory px-3 py-1"><ShoppingBag className="h-3 w-3" aria-hidden /> Minimum order {formatMoney(o.min_order_minor)}</li>}
            {o.max_qty_per_item < 99 && <li className="rounded-full bg-ivory px-3 py-1">Up to {o.max_qty_per_item} of each item</li>}
            {o.fulfillment_options.length === 1 && <li className="rounded-full bg-ivory px-3 py-1">{o.fulfillment_options[0] === 'pickup' ? 'Pickup only' : 'Campus meetup only'}</li>}
          </ul>
        )}
      </Card>
      <section aria-labelledby="sp">
        <h2 id="sp" className="mb-3 text-xl font-bold">Menu & listings</h2>
        {products.loading ? <Loading /> : products.error ? <ErrorState message={products.error} onRetry={products.reload} /> : products.data?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{products.data.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        ) : <Empty title="This store has not published anything yet" />}
      </section>
      {!!offers.data?.length && (
        <section aria-labelledby="offers">
          <h2 id="offers" className="mb-3 text-xl font-bold">Offers</h2>
          <OfferList vouchers={offers.data} />
        </section>
      )}
      {plans.data?.some((p) => p.active) && (
        <section aria-labelledby="plans">
          <h2 id="plans" className="mb-3 text-xl font-bold">Memberships</h2>
          <PlanCards plans={(plans.data ?? []).filter((p) => p.active)} mine={(subs.data ?? []).filter((sub) => sub.store_id === id)} onChanged={() => { void subs.reload(); void plans.reload() }} />
        </section>
      )}
      <section aria-labelledby="sr">
        <h2 id="sr" className="mb-3 text-xl font-bold">Reviews</h2>
        <RatingBars hist={s.rating_hist} count={s.rating_count} />
        {reviews.data?.length ? (
          <ul className="space-y-3">{reviews.data.map((r) => <li key={r.id}><ReviewCard review={r} /></li>)}</ul>
        ) : <p className="text-taupe">No reviews yet. Reviews come from completed orders.</p>}
      </section>
    </div>
  )
}
