import { Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatMoney } from '@/lib/utils'
import { DEFAULT_THEME } from '@/lib/theme'
import type { Product, Store } from '@/lib/types'
import { Badge } from './ui/badge'
import { Card } from './ui/card'

export function StoreCard({ store }: { store: Store }) {
  const t = { ...DEFAULT_THEME, ...store.theme }
  return (
    <Link to={`/stores/${store.id}`} className="block">
      <Card className="h-full overflow-hidden p-0 transition-shadow hover:shadow-md">
        <div className="relative h-28 w-full" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.primary})` }}>
          {store.banner_url && <img src={store.banner_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
          <div className="absolute -bottom-6 left-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border-2 border-white bg-ivory font-heading text-xl font-extrabold text-forest/50 shadow">
            {store.logo_url ? <img src={store.logo_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : store.name.slice(0, 1).toUpperCase()}
          </div>
        </div>
        <div className="p-4 pt-8">
          <h3 className="font-bold">{store.name}</h3>
          <p className="line-clamp-2 text-sm text-taupe">{store.tagline || store.description}</p>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <Badge tone={store.is_open ? 'ok' : 'neutral'}>{store.is_open ? 'Open' : 'Closed'}</Badge>
            <Badge>{store.category}</Badge>
            {store.rating_count > 0 && (
              <span className="flex items-center gap-1 text-taupe"><Star className="h-3 w-3 fill-current" aria-hidden /> {store.rating_avg.toFixed(1)} ({store.rating_count})</span>
            )}
          </div>
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
          {product.image_urls[0] ? <img src={product.image_urls[0]} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : <span className="text-sm">No photo</span>}
        </div>
        <h3 className="font-bold">{product.title}</h3>
        <p className="text-terracotta font-semibold">
          {(product.variants.length > 0 || product.print_spec) && 'from '}{formatMoney(product.price_from_minor)}
          {product.print_spec ? ' / page' : product.kind === 'printing' ? ' (quote)' : product.listing_type === 'lend' ? ' borrow fee' : ''}
        </p>
        <div className="mt-1 flex gap-2">
          {product.in_stock ? <Badge tone="ok">Available</Badge> : <Badge tone="bad">Unavailable</Badge>}
          {product.listing_type !== 'new' && <Badge>{product.listing_type}</Badge>}
        </div>
      </Card>
    </Link>
  )
}
