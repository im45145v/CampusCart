import { Link } from 'react-router-dom'
import { StoreCard } from '@/components/Cards'
import { Empty } from '@/components/States'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { useFetch } from '@/lib/useFetch'
import type { Store } from '@/lib/types'
import { OrderList } from './Orders'

export default function Account() {
  const { user } = useAuth()
  const saved = useFetch<Store[]>('/api/me/saved-stores')
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold">Hi, {user?.name}</h1>
        <p className="text-taupe">{user?.email} · roles: {user?.roles.join(', ')}</p>
        <div className="mt-3 flex gap-2"><Button asChild variant="secondary"><Link to="/inbox">Messages</Link></Button>{!user?.roles.includes('seller') && <Button asChild><Link to="/seller">Start selling</Link></Button>}</div>
      </div>
      <section aria-labelledby="oh"><h2 id="oh" className="mb-3 text-xl font-bold">Order history</h2><OrderList /></section>
      <section aria-labelledby="ss">
        <h2 id="ss" className="mb-3 text-xl font-bold">Saved stores</h2>
        {saved.data?.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{saved.data.map((s) => <StoreCard key={s.id} store={s} />)}</div> : <Empty title="No saved stores yet" />}
      </section>
    </div>
  )
}
