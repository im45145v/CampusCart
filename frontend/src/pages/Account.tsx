import { useState } from 'react'
import { Link } from 'react-router-dom'
import { StoreCard } from '@/components/Cards'
import { Empty, Notice } from '@/components/States'
import { WalletPanel } from '@/components/WalletPanel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatMoney, formatTime } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import type { Store, Subscription } from '@/lib/types'
import { OrderList } from './Orders'

function AccountPlans({ subs, onChanged }: { subs: Subscription[]; onChanged: () => void }) {
  const [error, setError] = useState('')
  const act = async (path: string) => {
    setError('')
    try {
      await api(path, { method: 'POST' })
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the plan')
    }
  }
  if (!subs.length) return <Empty title="No memberships yet" />
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {subs.map((s) => (
          <li key={s.id}>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold"><Link className="underline" to={`/stores/${s.store_id}`}>{s.title}</Link></p>
                <p className="text-sm text-taupe">{s.store_name} · {formatMoney(s.price_minor)} / {s.period} · {s.discount_percent}% off · {s.status}{s.status === 'active' ? ` until ${formatTime(s.period_end)}` : ''}</p>
              </div>
              {s.status === 'active' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => act(`/api/subscriptions/${s.id}/renew`)}>Renew</Button>
                  <Button size="sm" variant="ghost" onClick={() => act(`/api/subscriptions/${s.id}/cancel`)}>Cancel</Button>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {error && <Notice tone="bad">{error}</Notice>}
    </div>
  )
}

export default function Account() {
  const { user } = useAuth()
  const saved = useFetch<Store[]>('/api/me/saved-stores')
  const subs = useFetch<Subscription[]>('/api/me/subscriptions')
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Hi, {user?.name}</h1>
          <p className="text-taupe">{user?.email}</p>
        </div>
        <div className="flex flex-wrap gap-2"><Button asChild variant="secondary"><Link to="/inbox">Messages</Link></Button>{!user?.roles.includes('seller') && <Button asChild><Link to="/seller">Start selling</Link></Button>}</div>
      </header>
      <section aria-labelledby="wallet"><h2 id="wallet" className="mb-3 text-lg font-bold">Campus wallet</h2><WalletPanel /></section>
      {(subs.data?.length ?? 0) > 0 && (
        <section aria-labelledby="plans">
          <h2 id="plans" className="mb-3 text-lg font-bold">Your plans</h2>
          <AccountPlans subs={subs.data ?? []} onChanged={() => void subs.reload()} />
        </section>
      )}
      <section aria-labelledby="oh"><h2 id="oh" className="mb-3 text-lg font-bold">Order history</h2><OrderList /></section>
      <section aria-labelledby="ss">
        <h2 id="ss" className="mb-3 text-lg font-bold">Saved stalls</h2>
        {saved.data?.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{saved.data.map((s) => <StoreCard key={s.id} store={s} />)}</div> : <Empty title="No saved stalls yet"><Button asChild variant="secondary"><Link to="/browse">Browse stalls</Link></Button></Empty>}
      </section>
    </div>
  )
}
