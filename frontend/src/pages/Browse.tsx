import { useSearchParams } from 'react-router-dom'
import { ProductCard, StoreCard } from '@/components/Cards'
import { Empty, ErrorState, Loading } from '@/components/States'
import { Field, Input, Select } from '@/components/ui/input'
import { rupeesToMinor } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import type { Product, Store } from '@/lib/types'

export default function Browse() {
  const [sp, setSp] = useSearchParams()
  const q = sp.get('q') ?? ''
  const category = sp.get('category') ?? ''
  const max = sp.get('max') ?? ''
  const available = sp.get('available') ?? ''
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp)
    if (v) n.set(k, v)
    else n.delete(k)
    setSp(n, { replace: true })
  }
  const products = useFetch<Product[]>('/api/products', {
    q, max_price: max ? rupeesToMinor(max) : undefined, in_stock: available === '1' ? true : undefined,
  })
  const stores = useFetch<Store[]>('/api/stores', { q, category: category || undefined })
  const shown = (products.data ?? []).filter((p) => !category || p.category === category || stores.data?.some((s) => s.id === p.store_id))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Browse</h1>
      <form role="search" className="grid gap-3 rounded-2xl border border-line bg-card p-4 sm:grid-cols-4" onSubmit={(e) => e.preventDefault()}>
        <Field label="Search"><Input value={q} onChange={(e) => set('q', e.target.value)} placeholder="Product or store" /></Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => set('category', e.target.value)}>
            <option value="">All</option>
            {['food', 'printing', 'handmade', 'goods', 'services'].map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Max price (₹)"><Input type="number" min={0} value={max} onChange={(e) => set('max', e.target.value)} /></Field>
        <Field label="Availability">
          <Select value={available} onChange={(e) => set('available', e.target.value)}>
            <option value="">Any</option><option value="1">In stock only</option>
          </Select>
        </Field>
      </form>
      <section aria-labelledby="bs">
        <h2 id="bs" className="mb-3 text-xl font-bold">Stores</h2>
        {stores.loading ? <Loading /> : stores.error ? <ErrorState message={stores.error} onRetry={stores.reload} /> : stores.data?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{stores.data.map((s) => <StoreCard key={s.id} store={s} />)}</div>
        ) : <Empty title="No stores match" />}
      </section>
      <section aria-labelledby="bp">
        <h2 id="bp" className="mb-3 text-xl font-bold">Products & services</h2>
        {products.loading ? <Loading /> : products.error ? <ErrorState message={products.error} onRetry={products.reload} /> : shown.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{shown.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        ) : <Empty title="No products match your filters" />}
      </section>
    </div>
  )
}
