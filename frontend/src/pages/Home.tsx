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
  popular_products: Product[]
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
        <h1 className="max-w-xl font-heading text-3xl font-extrabold leading-tight text-white sm:text-4xl">
          Food, print, and the things you lend, from the people on your campus.
        </h1>
        <p className="mt-3 max-w-lg text-white/80">Order from student stores, borrow what is listed to lend, and pay with campus wallet credits or when you pick up.</p>
        <form onSubmit={submit} role="search" className="mt-6 flex max-w-xl gap-2">
          <label className="sr-only" htmlFor="home-search">Search products and stores</label>
          <Input id="home-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search samosas, posters, notes…" className="h-12" />
          <Button size="lg" type="submit"><Search className="h-4 w-4" aria-hidden /> Search</Button>
        </form>
        <Button asChild variant="secondary" className="mt-4"><Link to="/seller">Start Selling</Link></Button>
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
          <section aria-labelledby="fs">
            <h2 id="fs" className="mb-3 text-xl font-bold">Featured stores</h2>
            {data.featured_stores.length === 0 ? <p className="text-taupe">No stores yet. Be the first to <Link className="text-terracotta underline" to="/seller">open one</Link>.</p> : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.featured_stores.map((s) => <StoreCard key={s.id} store={s} />)}</div>
            )}
          </section>
          <section aria-labelledby="pp">
            <h2 id="pp" className="mb-3 text-xl font-bold">Popular right now</h2>
            {data.popular_products.length === 0 ? <p className="text-taupe">Nothing listed yet.</p> : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{data.popular_products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
