import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MessageButton, ReportButton } from '@/components/ContactButtons'
import { ErrorState, Loading, Notice } from '@/components/States'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { useAuth } from '@/lib/auth'
import { useCart } from '@/lib/cartContext'
import { themeStyle } from '@/lib/theme'
import { formatMoney } from '@/lib/utils'
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
  const [added, setAdded] = useState(false)

  if (product.loading) return <Loading />
  if (product.error || !product.data) return <ErrorState message={product.error ?? 'Not found'} />
  const p = product.data
  const maxQty = store.data?.order_settings?.max_qty_per_item ?? 99
  const variant = p.variants.find((v) => v.id === (variantId || p.variants[0]?.id))
  const price = variant ? variant.price_minor : p.price_minor
  const add = () => {
    cart.add({
      storeId: p.store_id, storeName: store.data?.name ?? '', productId: p.id, variantId: variant?.id ?? null,
      title: p.title, variantName: variant?.name ?? null, unitPriceMinor: price, quantity: Math.min(qty, maxQty),
    })
    setAdded(true)
  }
  return (
    <div className="grid gap-8 rounded-3xl bg-ivory p-3 sm:p-5 md:grid-cols-2" style={themeStyle(store.data?.theme)}>
      <div className="flex h-72 items-center justify-center overflow-hidden rounded-2xl border border-line bg-card text-taupe">
        {p.image_urls[0] ? <img src={p.image_urls[0]} alt={p.title} className="h-full w-full object-cover" /> : 'No photo'}
      </div>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold">{p.title}</h1>
          {store.data && <Link className="text-sm text-terracotta underline" to={`/stores/${store.data.id}`}>{store.data.name}</Link>}
        </div>
        <p className="text-2xl font-bold text-terracotta">{formatMoney(price)}{p.kind === 'printing' && <span className="ml-2 text-sm font-normal text-taupe">estimate; the seller sends a quote</span>}</p>
        <div className="flex flex-wrap gap-2">
          {p.in_stock ? <Badge tone="ok">Available</Badge> : <Badge tone="bad">Unavailable</Badge>}
          {p.stock !== null && p.stock > 0 && p.stock <= 5 && <Badge tone="warn">Only {p.stock} left</Badge>}
          {p.prep_time_min > 0 && <Badge>Ready in ~{p.prep_time_min} min</Badge>}
          {p.listing_type !== 'new' && <Badge>{p.listing_type}{p.condition ? `, ${p.condition}` : ''}</Badge>}
        </div>
        <p className="whitespace-pre-line text-taupe">{p.description}</p>
        {p.variants.length > 0 && (
          <Field label="Option">
            <Select value={variant?.id} onChange={(e) => setVariantId(e.target.value)}>
              {p.variants.map((v) => <option key={v.id} value={v.id} disabled={v.stock === 0}>{v.name}, {formatMoney(v.price_minor)}{v.stock === 0 ? ' (sold out)' : ''}</option>)}
            </Select>
          </Field>
        )}
        <div className="flex items-end gap-3">
          <Field label="Quantity"><Input type="number" min={1} max={maxQty} value={Math.min(qty, maxQty)} onChange={(e) => setQty(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))} className="w-24" /></Field>
          <Button size="lg" disabled={!p.in_stock || user?.id === store.data?.owner_id} onClick={add}>Add to cart</Button>
        </div>
        {added && <Notice tone="ok">Added to cart. <Link className="underline" to="/cart">View cart</Link></Notice>}
        <div className="flex flex-wrap items-center gap-2">
          {user?.id !== store.data?.owner_id && <MessageButton storeId={p.store_id} productId={p.id} label="Ask about this item" />}
          <ReportButton targetType="product" targetId={p.id} />
        </div>
      </div>
    </div>
  )
}
