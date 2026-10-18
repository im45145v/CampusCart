import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MessageButton, ReportButton } from '@/components/ContactButtons'
import { DetailSkeleton, ErrorState, Notice } from '@/components/States'
import { useToast } from '@/components/Toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { PrintDesk } from '@/components/PrintDesk'
import { useAuth } from '@/lib/auth'
import type { CartAddon } from '@/lib/cart'
import { useCart } from '@/lib/cartContext'
import { themeStyle } from '@/lib/theme'
import { cn, formatMoney, paysUpfront } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import type { Product, Store } from '@/lib/types'

export default function ProductPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const cart = useCart()
  const toast = useToast()
  const product = useFetch<Product>(`/api/products/${id}`)
  const store = useFetch<Store>(product.data ? `/api/stores/${product.data.store_id}` : null)
  const [variantId, setVariantId] = useState('')
  const [qty, setQty] = useState(1)
  const [extras, setExtras] = useState<Record<string, number>>({})
  const [added, setAdded] = useState(false)
  const [photo, setPhoto] = useState(0)
  const [seenId, setSeenId] = useState(id)
  if (seenId !== id) {
    setSeenId(id)
    setPhoto(0)
    setAdded(false)
    setVariantId('')
    setQty(1)
    setExtras({})
  }

  if (product.loading) return <DetailSkeleton />
  if (product.error || !product.data) return <ErrorState message={product.error ?? 'Not found'} />
  const p = product.data
  const maxQty = store.data?.order_settings?.max_qty_per_item ?? 99
  const variant = p.variants.find((v) => v.id === (variantId || p.variants[0]?.id))
  const price = variant ? variant.price_minor : p.price_minor
  const addons = p.addons ?? []
  const chosen: CartAddon[] = addons.filter((a) => (extras[a.id] ?? 0) > 0).map((a) => ({ id: a.id, name: a.name, priceMinor: a.price_minor, quantity: extras[a.id] }))
  const extraMinor = chosen.reduce((sum, a) => sum + a.priceMinor * a.quantity, 0)
  const images = p.image_urls
  const src = images[photo] ?? images[0]
  const own = user?.id === store.data?.owner_id
  const add = () => {
    cart.add({
      storeId: p.store_id, storeName: store.data?.name ?? '', productId: p.id, variantId: variant?.id ?? null,
      title: p.title, variantName: variant?.name ?? null, unitPriceMinor: price, quantity: Math.min(qty, maxQty),
      listingType: p.listing_type, rateUnit: p.rate_unit, maxUnits: p.max_units,
      addons: chosen,
    })
    setAdded(true)
    toast('ok', 'Added to cart')
  }
  return (
    <div className="grid gap-8 rounded-3xl bg-ivory p-1 sm:p-2 md:grid-cols-2" style={themeStyle(store.data?.theme)}>
      <div className="space-y-3">
        <div className="group flex h-72 items-center justify-center overflow-hidden rounded-2xl border border-line bg-card text-taupe sm:h-96">
          {src ? <img src={src} alt={p.title} referrerPolicy="no-referrer" decoding="async" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" /> : 'No photo'}
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {images.map((url, i) => (
              <button key={url} type="button" aria-label={`Photo ${i + 1}`} aria-pressed={i === photo} onClick={() => setPhoto(i)} className={cn('h-16 w-16 shrink-0 overflow-hidden rounded-xl border', i === photo ? 'border-terracotta' : 'border-line')}>
                <img src={url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{p.title}</h1>
          {store.data && (
            <p className="mt-1 text-sm text-taupe">
              <Link className="font-medium text-terracotta underline-offset-2 hover:underline" to={`/stores/${store.data.id}`}>{store.data.name}</Link>
              {' · '}{store.data.is_open ? 'Open' : 'Closed'}
            </p>
          )}
        </div>
        <p className="text-2xl font-bold text-terracotta">{formatMoney(p.print_spec ? p.price_from_minor : price + extraMinor)}{p.print_spec && <span className="ml-2 text-sm font-normal text-taupe">per page, before paper and binding</span>}{p.kind === 'printing' && !p.print_spec && <span className="ml-2 text-sm font-normal text-taupe">estimate; the seller sends a quote</span>}{p.rate_unit && <span className="ml-2 text-sm font-normal text-taupe">per {p.rate_unit}{p.max_units ? `, up to ${p.max_units} ${p.rate_unit}${p.max_units === 1 ? '' : 's'}` : ''}</span>}</p>
        <div className="flex flex-wrap gap-2">
          {p.in_stock ? <Badge tone="ok">Available</Badge> : <Badge tone="bad">Unavailable</Badge>}
          {p.stock !== null && p.stock > 0 && p.stock <= 5 && <Badge tone="warn">Only {p.stock} left</Badge>}
          {p.prep_time_min > 0 && <Badge>Ready in ~{p.prep_time_min} min</Badge>}
          {p.listing_type !== 'new' && <Badge>{p.listing_type}{p.condition ? `, ${p.condition}` : ''}</Badge>}
          {p.kind === 'service' && <Badge>Service</Badge>}
          {p.kind === 'printing' && <Badge>Printing</Badge>}
          {p.category === 'food' && <Badge>Food</Badge>}
        </div>
        {(p.listing_type === 'lend' || p.listing_type === 'rent') && (
          <Notice tone="ok">This is a borrow. The price is the seller’s rate for each day or hour you keep it, up to the limit on the listing. It stays off the shelf until you bring it back.</Notice>
        )}
        {paysUpfront(store.data?.order_settings?.payment_options) && (
          <Notice tone="ok">Pay upfront with campus credits. This stall does not take cash when you collect. A cancel or rejection returns the credits.</Notice>
        )}
        <p className="whitespace-pre-line leading-relaxed text-taupe">{p.description}</p>
        {p.variants.length > 0 && (
          <Field label="Option">
            <Select value={variant?.id} onChange={(e) => setVariantId(e.target.value)}>
              {p.variants.map((v) => <option key={v.id} value={v.id} disabled={v.stock === 0}>{v.name}, {formatMoney(v.price_minor)}{v.stock === 0 ? ' (sold out)' : ''}</option>)}
            </Select>
          </Field>
        )}
        {addons.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">Extras</legend>
            {addons.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{a.name} <span className="text-taupe">+{formatMoney(a.price_minor)}</span></span>
                <Input className="w-24" type="number" min={0} max={a.max_qty} aria-label={a.name} value={extras[a.id] ?? 0} onChange={(e) => setExtras({ ...extras, [a.id]: Math.max(0, Math.min(a.max_qty, Number(e.target.value) || 0)) })} />
              </div>
            ))}
          </fieldset>
        )}
        {p.print_spec ? <PrintDesk product={p} disabled={own} onAdd={(job) => { cart.add({ storeId: p.store_id, storeName: store.data?.name ?? '', productId: p.id, variantId: null, title: p.title, variantName: null, unitPriceMinor: job.totalMinor, quantity: 1, printJob: job }); setAdded(true); toast('ok', 'Print job added to cart') }} /> : (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Quantity"><Input type="number" min={1} max={maxQty} value={Math.min(qty, maxQty)} onChange={(e) => setQty(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))} className="w-24" /></Field>
          <Button size="lg" disabled={!p.in_stock || own} onClick={add}>{p.listing_type === 'lend' ? 'Borrow' : 'Add to cart'}</Button>
        </div>
        )}
        {added && <Notice tone="ok">Added to cart. <Link className="font-medium underline" to="/cart">View cart</Link></Notice>}
        <div className="flex flex-wrap items-center gap-2">
          {!own && <MessageButton storeId={p.store_id} productId={p.id} label="Ask about this item" />}
          <ReportButton targetType="product" targetId={p.id} />
        </div>
      </div>
    </div>
  )
}
