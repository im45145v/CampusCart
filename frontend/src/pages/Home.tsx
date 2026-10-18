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
        <p className="text-sm font-semibold tracking-wide text-[#f0a58b]">For the student running the stall</p>
        <h1 className="mt-2 max-w-2xl font-heading text-3xl font-extrabold leading-tight text-white sm:text-4xl">
          A listing writer and a till, for a campus side hustle.
        </h1>
        <p className="mt-3 max-w-2xl text-white/80">
          A wok counter, a print desk, or a projector you lend from your room. Gemma 4 turns a sentence you actually said into a listing.
          It fills only the price, stock, and time you stated. It never invents a number, and it never publishes.
          Students pay with campus wallet credits or when they pick up.
        </p>
        <form onSubmit={submit} role="search" className="mt-6 flex max-w-xl gap-2">
          <label className="sr-only" htmlFor="home-search">Search products and stores</label>
          <Input id="home-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search fried rice, print, projector…" className="h-12 bg-white text-ink" />
          <Button size="lg" type="submit"><Search className="h-4 w-4" aria-hidden /> Search</Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="lg"><Link to="/seller">Open Seller Studio</Link></Button>
          <Button asChild variant="secondary" size="lg"><Link to="/browse">See the stalls</Link></Button>
        </div>
        <ul className="mt-8 grid gap-3 text-sm sm:grid-cols-3">
          <li className="rounded-2xl bg-white/10 p-4">
            <p className="font-semibold text-white">Who pays</p>
            <p className="mt-1 text-white/80">The seller, for a stall that takes orders without a group chat.</p>
          </li>
          <li className="rounded-2xl bg-white/10 p-4">
            <p className="font-semibold text-white">What Gemma does</p>
            <p className="mt-1 text-white/80">Drafts the listing from your words. You review every field before it exists.</p>
          </li>
          <li className="rounded-2xl bg-white/10 p-4">
            <p className="font-semibold text-white">How buyers pay</p>
            <p className="mt-1 text-white/80">Campus wallet credits or pay on pickup. No bank payment is verified.</p>
          </li>
        </ul>
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
