import { Clock, Heart, MapPin, Star } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { MessageButton, ReportButton } from '@/components/ContactButtons'
import { ProductCard } from '@/components/Cards'
import { Empty, ErrorState, Loading } from '@/components/States'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatTime } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import type { Product, Review, Store } from '@/lib/types'

export default function StorePage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const store = useFetch<Store>(`/api/stores/${id}`)
  const products = useFetch<Product[]>(`/api/stores/${id}/products`)
  const reviews = useFetch<Review[]>(`/api/stores/${id}/reviews`)
  const saved = useFetch<Store[]>(user ? '/api/me/saved-stores' : null)
  const isSaved = saved.data?.some((s) => s.id === id) ?? false

  if (store.loading) return <Loading />
  if (store.error || !store.data) return <ErrorState message={store.error ?? 'Store not found'} />
  const s = store.data
  const toggleSave = async () => {
    await api(`/api/me/saved-stores/${id}`, { method: isSaved ? 'DELETE' : 'PUT' })
    void saved.reload()
  }
  return (
    <div className="space-y-8">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">{s.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={s.is_open ? 'ok' : 'neutral'}>{s.is_open ? 'Open now' : 'Closed'}</Badge>
              <Badge>{s.category}</Badge>
              {s.rating_count > 0 && <span className="flex items-center gap-1 text-taupe"><Star className="h-4 w-4 fill-current" aria-hidden /> {s.rating_avg.toFixed(1)} ({s.rating_count} reviews)</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {user && user.id !== s.owner_id && <MessageButton storeId={s.id} />}
            {user && <Button variant="secondary" onClick={toggleSave} aria-pressed={isSaved}><Heart className={`h-4 w-4 ${isSaved ? 'fill-terracotta text-terracotta' : ''}`} aria-hidden /> {isSaved ? 'Saved' : 'Save store'}</Button>}
            <ReportButton targetType="store" targetId={s.id} />
          </div>
        </div>
        <p className="text-taupe">{s.description}</p>
        {s.operating_hours && <p className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4" aria-hidden /> {s.operating_hours}</p>}
        {s.pickup_details && <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4" aria-hidden /> {s.pickup_details}</p>}
      </Card>
      <section aria-labelledby="sp">
        <h2 id="sp" className="mb-3 text-xl font-bold">Menu & listings</h2>
        {products.loading ? <Loading /> : products.error ? <ErrorState message={products.error} onRetry={products.reload} /> : products.data?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{products.data.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        ) : <Empty title="This store has not published anything yet" />}
      </section>
      <section aria-labelledby="sr">
        <h2 id="sr" className="mb-3 text-xl font-bold">Reviews</h2>
        {reviews.data?.length ? (
          <ul className="space-y-3">
            {reviews.data.map((r) => (
              <li key={r.id}><Card><p className="font-semibold">{'★'.repeat(r.rating)}<span className="sr-only"> {r.rating} out of 5</span> <span className="font-normal text-taupe">by {r.buyer_name}, {formatTime(r.created_at)}</span></p>{r.comment && <p>{r.comment}</p>}</Card></li>
            ))}
          </ul>
        ) : <p className="text-taupe">No reviews yet. Reviews come from completed orders.</p>}
      </section>
    </div>
  )
}
