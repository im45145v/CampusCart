import { Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProductCard, StoreCard } from '@/components/Cards'
import { ErrorState, Loading } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFetch } from '@/lib/useFetch'
import type { Product, Store } from '@/lib/types'

interface HomeData {
  categories: { slug: string; stores: number }[]
  featured_stores: Store[]
  featured_products: Product[]
  latest_products: Product[]
  popular_products: Product[]
  category_rails: { slug: string; products: Product[] }[]
}

const STEPS = [
  ['Pick a stall', 'Food, a print job, or gear you can borrow. Each stall is run by a student on this campus.'],
  ['Pay the way that stall asks', 'Some take campus credits when you order. Others still take cash when you collect.'],
  ['Collect on campus', 'Use the stall’s pickup spot or a campus meetup. Message the stall from the listing if a detail is still open.'],
]

function ProductRail({ id, title, products, more }: { id: string; title: string; products: Product[]; more?: string }) {
  if (!products.length) return null
  return (
    <section aria-labelledby={id}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-xl font-bold">{title}</h2>
        {more && <Link className="text-sm text-terracotta underline" to={more}>See all</Link>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
    </section>
  )
}

export default function Home() {
  const { data, error, loading, reload } = useFetch<HomeData>('/api/home')
  const [q, setQ] = useState('')
  const nav = useNavigate()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    nav(`/browse?q=${encodeURIComponent(q)}`)
  }
  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-forest px-6 py-10 text-white sm:px-10">
        <h1 className="max-w-2xl font-heading text-3xl font-extrabold leading-tight text-white sm:text-4xl">
          Order from a campus stall, or run one.
        </h1>
        <p className="mt-3 max-w-2xl text-white/80">
          Food, print, and gear you can borrow. Some stalls take campus credits when you order. Others still take cash when you pick up.
        </p>
        <form onSubmit={submit} role="search" className="mt-6 flex max-w-xl gap-2">
          <label className="sr-only" htmlFor="home-search">Search products and stores</label>
          <Input id="home-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search fried rice, print, projector…" className="h-12 bg-white text-ink" />
          <Button size="lg" type="submit"><Search className="h-4 w-4" aria-hidden /> Search</Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="lg"><Link to="/browse">See the stalls</Link></Button>
          <Button asChild size="lg"><Link to="/seller">Open your stall</Link></Button>
        </div>
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="mb-3 text-xl font-bold">How an order works</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="rounded-2xl border border-line bg-card p-4">
              <p className="text-xs font-bold text-terracotta">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="mt-1 font-bold">{title}</h3>
              <p className="mt-1 text-sm text-taupe">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <>
          <section aria-labelledby="cats">
            <h2 id="cats" className="mb-3 text-xl font-bold">Categories</h2>
            <div className="flex flex-wrap gap-2">
              {data.categories.map((c) => (
                <Button key={c.slug} asChild variant="secondary"><Link to={`/browse?category=${c.slug}`} className="capitalize">{c.slug} ({c.stores})</Link></Button>
              ))}
            </div>
          </section>
          <ProductRail id="featured" title="Featured listings" products={data.featured_products} />
          <section aria-labelledby="fs">
            <h2 id="fs" className="mb-3 text-xl font-bold">Stalls</h2>
            {data.featured_stores.length === 0 ? <p className="text-taupe">No stores yet. Be the first to <Link className="text-terracotta underline" to="/seller">open one</Link>.</p> : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.featured_stores.map((s) => <StoreCard key={s.id} store={s} />)}</div>
            )}
          </section>
          {data.category_rails.map((rail) => (
            <ProductRail key={rail.slug} id={`rail-${rail.slug}`} title={rail.slug.charAt(0).toUpperCase() + rail.slug.slice(1)} products={rail.products} more={`/browse?category=${rail.slug}`} />
          ))}
          <ProductRail id="latest" title="Just listed" products={data.latest_products} more="/browse" />
          <ProductRail id="pp" title="Popular right now" products={data.popular_products} />
        </>
      )}
    </div>
  )
}
