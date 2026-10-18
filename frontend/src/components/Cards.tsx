import { Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatMoney, paysUpfront } from '@/lib/utils'
import { DEFAULT_THEME } from '@/lib/theme'
import type { Product, Store } from '@/lib/types'
import { Badge } from './ui/badge'

function priceLabel(product: Product): string {
  const money = formatMoney(product.price_from_minor)
  const from = product.variants.length > 0 || product.print_spec ? 'From ' : ''
  if (product.print_spec) return `${from}${money} / page`
  if (product.kind === 'printing') return `${money} estimate`
  if (product.listing_type === 'lend' || product.listing_type === 'rent') {
    return `${money}${product.rate_unit ? ` / ${product.rate_unit}` : ''} borrow fee`
  }
  if (product.rate_unit) return `${money} / ${product.rate_unit}`
  return `${from}${money}`
}

function listingMeta(product: Product): string | null {
  if (product.print_spec) return 'Priced from the uploaded file'
  if (product.kind === 'printing') return 'The seller sends a quote'
  if (product.listing_type === 'lend' || product.listing_type === 'rent') {
    const parts = [product.listing_type === 'lend' ? 'Borrow' : 'Rent']
    if (product.condition) parts.push(product.condition)
    if (product.max_units && product.rate_unit) {
      const unit = `${product.rate_unit}${product.max_units === 1 ? '' : 's'}`
      parts.push(`up to ${product.max_units} ${unit}`)
    }
    return parts.join(' · ')
  }
  if (product.kind === 'service') return product.prep_time_min > 0 ? `Service · about ${product.prep_time_min} min` : 'Service'
  if (product.category === 'food') return product.prep_time_min > 0 ? `Food · about ${product.prep_time_min} min` : 'Food'
  if (product.listing_type === 'secondhand') return product.condition ? `Secondhand · ${product.condition}` : 'Secondhand'
  if (product.listing_type === 'exchange') return 'Exchange'
  if (product.prep_time_min > 0) return `Ready in about ${product.prep_time_min} min`
  return null
}

export function StoreCard({ store }: { store: Store }) {
  const t = { ...DEFAULT_THEME, ...store.theme }
  return (
    <Link to={`/stores/${store.id}`} className="group block h-full rounded-2xl focus-visible:outline-none">
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(23,37,84,0.05)] transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
        <div className="relative h-28 overflow-hidden" style={{ background: t.primary }}>
          {store.banner_url && <img src={store.banner_url} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />}
          <div className="absolute bottom-3 left-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border-2 border-white bg-card font-heading text-lg font-extrabold text-taupe shadow-sm">
            {store.logo_url ? <img src={store.logo_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : store.name.slice(0, 1).toUpperCase()}
          </div>
        </div>
        <div className="flex flex-1 flex-col p-4 pt-3">
          <h3 className="font-semibold">{store.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-taupe">{store.tagline || store.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <Badge tone={store.is_open ? 'ok' : 'neutral'}>{store.is_open ? 'Open' : 'Closed'}</Badge>
            <Badge>{store.category}</Badge>
            {paysUpfront(store.order_settings?.payment_options) && <Badge tone="warn">Pay upfront</Badge>}
            {store.rating_count > 0 && (
              <span className="flex items-center gap-1 text-taupe"><Star className="h-3 w-3 fill-current" aria-hidden /> {store.rating_avg.toFixed(1)} ({store.rating_count})</span>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}

export function ProductCard({ product }: { product: Product }) {
  const meta = listingMeta(product)
  const low = product.stock !== null && product.stock > 0 && product.stock <= 5
  return (
    <Link to={`/products/${product.id}`} className="group block h-full rounded-2xl focus-visible:outline-none">
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(23,37,84,0.05)] transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
        <div className="relative aspect-[4/3] overflow-hidden bg-mist">
          {product.image_urls[0]
            ? <img src={product.image_urls[0]} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
            : <span className="flex h-full items-center justify-center text-sm text-taupe">No photo</span>}
        </div>
        <div className="flex flex-1 flex-col p-3.5">
          <h3 className="line-clamp-2 font-semibold leading-snug">{product.title}</h3>
          <p className="mt-1 text-sm font-semibold text-terracotta">{priceLabel(product)}</p>
          {meta && <p className="mt-1 text-xs text-taupe">{meta}</p>}
          <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
            {product.featured && <Badge tone="warn">Featured</Badge>}
            {!product.in_stock ? <Badge tone="bad">Unavailable</Badge> : low ? <Badge tone="warn">Only {product.stock} left</Badge> : <Badge tone="ok">Available</Badge>}
            {product.listing_type !== 'new' && <Badge>{product.listing_type}</Badge>}
          </div>
        </div>
      </article>
    </Link>
  )
}
