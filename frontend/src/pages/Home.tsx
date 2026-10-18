import { Palette, Printer, Repeat, Search, ShoppingBag, Tag, UtensilsCrossed, Wrench, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProductCard, StoreCard } from '@/components/Cards'
import { Empty, ErrorState, SkeletonCards } from '@/components/States'
import { Button } from '@/components/ui/button'
import type { Product, Store } from '@/lib/types'
import { useFetch } from '@/lib/useFetch'

interface HomeData {
  categories: { slug: string; stores: number }[]
  featured_stores: Store[]
  featured_products: Product[]
  latest_products: Product[]
  popular_products: Product[]
  category_rails: { slug: string; products: Product[] }[]
}

const ICONS: Record<string, LucideIcon> = {
  food: UtensilsCrossed,
  printing: Printer,
  handmade: Palette,
  goods: ShoppingBag,
  services: Wrench,
  lending: Repeat,
}

const STEPS = [
  ['Pick a stall', 'Food, a print job, or gear you can borrow. Each stall is run by a student on this campus.'],
  ['Pay the way that stall asks', 'Some take campus credits when you order. Others still take cash when you collect.'],
  ['Collect on campus', 'Use the stall’s pickup spot or a campus meetup. Message the stall if a detail is still open.'],
]

function unseen(products: Product[], seen: Set<string>) {
  const next: Product[] = []
  for (const product of products) {
    if (seen.has(product.id)) continue
    seen.add(product.id)
    next.push(product)
  }
  return next
}

function ProductRail({ id, title, products, more }: { id: string; title: string; products: Product[]; more?: string }) {
  if (!products.length) return null
  return (
    <section aria-labelledby={id}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 id={id} className="text-lg font-bold">{title}</h2>
        {more && <Link className="text-sm font-medium text-terracotta underline-offset-2 hover:underline" to={more}>See all</Link>}
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
    nav(`/browse?q=${encodeURIComponent(q.trim())}`)
  }
  const seen = new Set<string>()
  const featured = data ? unseen(data.featured_products, seen) : []
  const rails = data ? data.category_rails.map((rail) => ({ ...rail, products: unseen(rail.products, seen) })) : []
  const latest = data ? unseen(data.latest_products, seen) : []
  const popular = data ? unseen(data.popular_products, seen) : []

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">Find something on campus</h1>
            <p className="mt-1 max-w-xl text-sm text-taupe">Food, print, services, and gear you can borrow from student stalls.</p>
          </div>
          <Button asChild variant="secondary"><Link to="/seller">Open a stall</Link></Button>
        </div>
        <form onSubmit={submit} role="search" className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="home-search">Search products and stores</label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-taupe" aria-hidden />
            <input id="home-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search fried rice, print, projector…" className="h-12 w-full rounded-xl border border-line bg-card pr-3 pl-9 text-sm shadow-sm placeholder:text-taupe/70 focus-visible:border-terracotta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/25" />
          </div>
          <Button size="lg" type="submit">Search</Button>
        </form>
      </section>

      {loading && <SkeletonCards count={4} />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <>
          <section aria-labelledby="cats">
            <h2 id="cats" className="mb-3 text-lg font-bold">Categories</h2>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {data.categories.map((c) => {
                const Icon = ICONS[c.slug] ?? Tag
                return (
                  <Link key={c.slug} to={`/browse?category=${c.slug}`} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-medium capitalize transition-colors duration-200 hover:border-terracotta/30 hover:bg-mist">
                    <Icon className="h-4 w-4 text-terracotta" aria-hidden />
                    {c.slug}
                    <span className="text-taupe">{c.stores}</span>
                  </Link>
                )
              })}
            </div>
          </section>
          <ProductRail id="featured" title="Featured listings" products={featured} />
          <section aria-labelledby="fs">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 id="fs" className="text-lg font-bold">Campus stalls</h2>
              <Link className="text-sm font-medium text-terracotta underline-offset-2 hover:underline" to="/browse">See all</Link>
            </div>
            {data.featured_stores.length === 0
              ? <Empty title="No stalls yet"><Link className="font-medium text-terracotta underline-offset-2 hover:underline" to="/seller">Open the first stall</Link></Empty>
              : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.featured_stores.map((s) => <StoreCard key={s.id} store={s} />)}</div>}
          </section>
          {rails.map((rail) => (
            <ProductRail key={rail.slug} id={`rail-${rail.slug}`} title={rail.slug.charAt(0).toUpperCase() + rail.slug.slice(1)} products={rail.products} more={`/browse?category=${rail.slug}`} />
          ))}
          <ProductRail id="latest" title="Just listed" products={latest} more="/browse?sort=new" />
          <ProductRail id="pp" title="Popular right now" products={popular} more="/browse?sort=popular" />
        </>
      )}

      <section aria-labelledby="how" className="border-t border-line pt-8">
        <h2 id="how" className="mb-4 text-lg font-bold">How an order works</h2>
        <ol className="grid gap-6 sm:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <li key={title}>
              <p className="text-sm font-semibold text-terracotta">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="mt-1 font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-taupe">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
