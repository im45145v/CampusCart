import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MessageButton, ReportButton } from '@/components/ContactButtons'
import { ErrorState, Loading, Notice } from '@/components/States'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { PrintDesk } from '@/components/PrintDesk'
import { useAuth } from '@/lib/auth'
import type { CartAddon } from '@/lib/cart'
import { useCart } from '@/lib/cartContext'
import { themeStyle } from '@/lib/theme'
import { formatMoney, paysUpfront } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import type { Product, Store } from '@/lib/types'

export default function ProductPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const cart = useCart()
  const product = useFetch<Product>(`/api/products/${id}`)
  const store = useFetch<Store>(product.data ? `/api/stores/${product.data.store_id}` : null)
  const [variantId, setVariantId] = useState('')
  const [qty, setQty] = useState(1)
  const [extras, setExtras] = useState<Record<string, number>>({})
  const [added, setAdded] = useState(false)

  if (product.loading) return <Loading />
  if (product.error || !product.data) return <ErrorState message={product.error ?? 'Not found'} />
  const p = product.data
  const maxQty = store.data?.order_settings?.max_qty_per_item ?? 99
  const variant = p.variants.find((v) => v.id === (variantId || p.variants[0]?.id))
  const price = variant ? variant.price_minor : p.price_minor
  const addons = p.addons ?? []
  const chosen: CartAddon[] = addons.filter((a) => (extras[a.id] ?? 0) > 0).map((a) => ({ id: a.id, name: a.name, priceMinor: a.price_minor, quantity: extras[a.id] }))
  const extraMinor = chosen.reduce((sum, a) => sum + a.priceMinor * a.quantity, 0)
  const add = () => {
    cart.add({
      storeId: p.store_id, storeName: store.data?.name ?? '', productId: p.id, variantId: variant?.id ?? null,
      title: p.title, variantName: variant?.name ?? null, unitPriceMinor: price, quantity: Math.min(qty, maxQty),
      listingType: p.listing_type, rateUnit: p.rate_unit, maxUnits: p.max_units,
      addons: chosen,
    })
    setAdded(true)
  }
  return (
    <div className="grid gap-8 rounded-3xl bg-ivory p-3 sm:p-5 md:grid-cols-2" style={themeStyle(store.data?.theme)}>
      <div className="flex h-72 items-center justify-center overflow-hidden rounded-2xl border border-line bg-card text-taupe">
        {p.image_urls[0] ? <img src={p.image_urls[0]} alt={p.title} referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : 'No photo'}
      </div>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold">{p.title}</h1>
          {store.data && <Link className="text-sm text-terracotta underline" to={`/stores/${store.data.id}`}>{store.data.name}</Link>}
        </div>
        <p className="text-2xl font-bold text-terracotta">{formatMoney(p.print_spec ? p.price_from_minor : price + extraMinor)}{p.print_spec && <span className="ml-2 text-sm font-normal text-taupe">per page, before paper and binding</span>}{p.kind === 'printing' && !p.print_spec && <span className="ml-2 text-sm font-normal text-taupe">estimate; the seller sends a quote</span>}{p.rate_unit && <span className="ml-2 text-sm font-normal text-taupe">per {p.rate_unit}{p.max_units ? `, up to ${p.max_units} ${p.rate_unit}${p.max_units === 1 ? '' : 's'}` : ''}</span>}</p>
        <div className="flex flex-wrap gap-2">
          {p.in_stock ? <Badge tone="ok">Available</Badge> : <Badge tone="bad">Unavailable</Badge>}
          {p.stock !== null && p.stock > 0 && p.stock <= 5 && <Badge tone="warn">Only {p.stock} left</Badge>}
          {p.prep_time_min > 0 && <Badge>Ready in ~{p.prep_time_min} min</Badge>}
          {p.listing_type !== 'new' && <Badge>{p.listing_type}{p.condition ? `, ${p.condition}` : ''}</Badge>}
        </div>
        {(p.listing_type === 'lend' || p.listing_type === 'rent') && (
          <Notice tone="ok">This is a borrow. The price is the seller’s rate for each day or hour you keep it, up to the limit on the listing. It stays off the shelf until you bring it back.</Notice>
        )}
        {paysUpfront(store.data?.order_settings?.payment_options) && (
          <Notice tone="ok">Pay upfront with campus credits. This stall does not take cash when you collect. A cancel or rejection returns the credits.</Notice>
        )}
        <p className="whitespace-pre-line text-taupe">{p.description}</p>
        {p.variants.length > 0 && (
          <Field label="Option">
            <Select value={variant?.id} onChange={(e) => setVariantId(e.target.value)}>
              {p.variants.map((v) => <option key={v.id} value={v.id} disabled={v.stock === 0}>{v.name}, {formatMoney(v.price_minor)}{v.stock === 0 ? ' (sold out)' : ''}</option>)}
            </Select>
          </Field>
        )}
        {addons.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-forest">Extras</legend>
            {addons.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{a.name} <span className="text-taupe">+{formatMoney(a.price_minor)}</span></span>
                <Input className="w-20" type="number" min={0} max={a.max_qty} aria-label={a.name} value={extras[a.id] ?? 0} onChange={(e) => setExtras({ ...extras, [a.id]: Math.max(0, Math.min(a.max_qty, Number(e.target.value) || 0)) })} />
              </div>
            ))}
          </fieldset>
        )}
        {p.print_spec ? <PrintDesk product={p} disabled={user?.id === store.data?.owner_id} onAdd={(job) => { cart.add({ storeId: p.store_id, storeName: store.data?.name ?? '', productId: p.id, variantId: null, title: p.title, variantName: null, unitPriceMinor: job.totalMinor, quantity: 1, printJob: job }); setAdded(true) }} /> : (
        <div className="flex items-end gap-3">
          <Field label="Quantity"><Input type="number" min={1} max={maxQty} value={Math.min(qty, maxQty)} onChange={(e) => setQty(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))} className="w-24" /></Field>
          <Button size="lg" disabled={!p.in_stock || user?.id === store.data?.owner_id} onClick={add}>{p.listing_type === 'lend' ? 'Borrow' : 'Add to cart'}</Button>
        </div>
        )}
        {added && <Notice tone="ok">Added to cart. <Link className="underline" to="/cart">View cart</Link></Notice>}
        <div className="flex flex-wrap items-center gap-2">
          {user?.id !== store.data?.owner_id && <MessageButton storeId={p.store_id} productId={p.id} label="Ask about this item" />}
          <ReportButton targetType="product" targetId={p.id} />
        </div>
      </div>
    </div>
  )
}
