import { SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProductCard, StoreCard } from '@/components/Cards'
import { Empty, ErrorState, SkeletonCards } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { cn, rupeesToMinor } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import { STORE_CATEGORIES, type Product, type Store } from '@/lib/types'

const PRODUCT_SORTS = [
  ['popular', 'Popular'],
  ['new', 'Newest'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
] as const
const STORE_SORTS = [
  ['rating', 'Top rated'],
  ['new', 'Newest'],
] as const

export default function Browse() {
  const [sp, setSp] = useSearchParams()
  const q = sp.get('q') ?? ''
  const category = sp.get('category') ?? ''
  const max = sp.get('max') ?? ''
  const available = sp.get('available') ?? ''
  const listing = sp.get('listing') ?? ''
  const sortParam = sp.get('sort') ?? 'popular'
  const sort = PRODUCT_SORTS.some(([v]) => v === sortParam) ? sortParam : 'popular'
  const storeSortParam = sp.get('ssort') ?? 'rating'
  const storeSort = STORE_SORTS.some(([v]) => v === storeSortParam) ? storeSortParam : 'rating'
  const activeFilters = [category, max, listing, available].filter(Boolean).length
  const [open, setOpen] = useState(activeFilters > 0)
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp)
    if (v) n.set(k, v)
    else n.delete(k)
    setSp(n, { replace: true })
  }
  const products = useFetch<Product[]>('/api/products', {
    q, listing_type: listing || undefined, max_price: max ? rupeesToMinor(max) : undefined, in_stock: available === '1' ? true : undefined, sort,
  })
  const stores = useFetch<Store[]>('/api/stores', { q, category: category || undefined, sort: storeSort })
  const shown = (products.data ?? []).filter((p) => !category || p.category === category || stores.data?.some((s) => s.id === p.store_id))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold">Browse</h1>
        <p className="mt-1 text-sm text-taupe">Stalls and listings on this campus.</p>
      </div>
      <form role="search" className="space-y-3 rounded-2xl border border-line bg-card p-4" onSubmit={(e) => e.preventDefault()}>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Field label="Search"><Input value={q} onChange={(e) => set('q', e.target.value)} placeholder="Product or stall" /></Field>
          <div className="flex items-end">
            <Button type="button" variant="secondary" className="w-full md:hidden" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
            </Button>
          </div>
        </div>
        <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', !open && 'max-md:hidden')}>
          <Field label="Category">
            <Select value={category} onChange={(e) => set('category', e.target.value)}>
              <option value="">All</option>
              {STORE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Listing">
            <Select value={listing} onChange={(e) => set('listing', e.target.value)}>
              <option value="">Any</option>
              {['new', 'secondhand', 'rent', 'lend', 'exchange'].map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Availability">
            <Select value={available} onChange={(e) => set('available', e.target.value)}>
              <option value="">Any</option><option value="1">In stock only</option>
            </Select>
          </Field>
          <Field label="Max price (₹)"><Input type="number" min={0} value={max} onChange={(e) => set('max', e.target.value)} /></Field>
          <Field label="Sort listings">
            <Select value={sort} onChange={(e) => set('sort', e.target.value === 'popular' ? '' : e.target.value)}>
              {PRODUCT_SORTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Sort stalls">
            <Select value={storeSort} onChange={(e) => set('ssort', e.target.value === 'rating' ? '' : e.target.value)}>
              {STORE_SORTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </Select>
          </Field>
        </div>
      </form>
      <section aria-labelledby="bs">
        <h2 id="bs" className="mb-4 text-lg font-bold">Stalls</h2>
        {stores.loading ? <SkeletonCards count={3} columns="sm:grid-cols-2 lg:grid-cols-3" /> : stores.error ? <ErrorState message={stores.error} onRetry={stores.reload} /> : stores.data?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{stores.data.map((s) => <StoreCard key={s.id} store={s} />)}</div>
        ) : <Empty title="No stalls match"><Button variant="secondary" onClick={() => setSp(new URLSearchParams())}>Clear filters</Button></Empty>}
      </section>
      <section aria-labelledby="bp">
        <h2 id="bp" className="mb-4 text-lg font-bold">Listings</h2>
        {products.loading ? <SkeletonCards count={4} /> : products.error ? <ErrorState message={products.error} onRetry={products.reload} /> : shown.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{shown.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        ) : <Empty title="No listings match your filters"><Button variant="secondary" onClick={() => setSp(new URLSearchParams())}>Clear filters</Button></Empty>}
      </section>
    </div>
  )
}
