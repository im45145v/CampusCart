import { Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatMoney } from '@/lib/utils'
import type { Product, Store } from '@/lib/types'
import { Badge } from './ui/badge'
import { Card } from './ui/card'

export function StoreCard({ store }: { store: Store }) {
  return (
    <Link to={`/stores/${store.id}`} className="block">
      <Card className="h-full transition-shadow hover:shadow-md">
        <div className="mb-3 flex h-28 items-center justify-center overflow-hidden rounded-xl bg-ivory font-heading text-3xl font-extrabold text-forest/40">
          {store.logo_url ? <img src={store.logo_url} alt="" className="h-full w-full object-cover" /> : store.name.slice(0, 1)}
        </div>
        <h3 className="font-bold">{store.name}</h3>
        <p className="line-clamp-2 text-sm text-taupe">{store.description}</p>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <Badge tone={store.is_open ? 'ok' : 'neutral'}>{store.is_open ? 'Open' : 'Closed'}</Badge>
          <Badge>{store.category}</Badge>
          {store.rating_count > 0 && (
            <span className="flex items-center gap-1 text-taupe"><Star className="h-3 w-3 fill-current" aria-hidden /> {store.rating_avg.toFixed(1)} ({store.rating_count})</span>
          )}
        </div>
      </Card>
    </Link>
  )
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link to={`/products/${product.id}`} className="block">
      <Card className="h-full transition-shadow hover:shadow-md">
        <div className="mb-3 flex h-32 items-center justify-center overflow-hidden rounded-xl bg-ivory text-taupe">
          {product.image_urls[0] ? <img src={product.image_urls[0]} alt="" className="h-full w-full object-cover" /> : <span className="text-sm">No photo</span>}
        </div>
        <h3 className="font-bold">{product.title}</h3>
        <p className="text-terracotta font-semibold">
          {product.variants.length > 0 && 'from '}{formatMoney(product.price_from_minor)}
          {product.kind === 'printing' && ' (quote)'}
        </p>
        <div className="mt-1 flex gap-2">
          {product.in_stock ? <Badge tone="ok">Available</Badge> : <Badge tone="bad">Unavailable</Badge>}
          {product.listing_type !== 'new' && <Badge>{product.listing_type}</Badge>}
        </div>
      </Card>
    </Link>
  )
}
