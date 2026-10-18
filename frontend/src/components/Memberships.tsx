import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Empty, Notice } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatMoney, formatTime, rupeesToMinor } from '@/lib/utils'
import type { Plan, Subscription } from '@/lib/types'

export function PlanCards({ plans, mine, onChanged }: { plans: Plan[]; mine: Subscription[]; onChanged?: () => void }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [error, setError] = useState('')
  const activeFor = (plan: Plan) => mine.find((s) => s.plan_id === plan.id && s.status === 'active' && new Date(s.period_end) > new Date())
  const act = async (path: string) => {
    if (!user) { nav('/login', { state: { from: loc.pathname } }); return }
    setError('')
    try {
      await api(path, { method: 'POST' })
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the plan')
    }
  }
  if (!plans.length) return <Empty title="No membership plans yet" />
  return (
    <div className="space-y-3">
      <ul className="grid gap-3 sm:grid-cols-2">
        {plans.filter((p) => p.active).map((p) => {
          const sub = activeFor(p)
          return (
            <li key={p.id}>
              <Card className="flex h-full flex-col gap-2">
                <div>
                  <p className="text-lg font-bold">{p.title}</p>
                  <p className="text-sm text-taupe">{p.description}</p>
                </div>
                <p className="font-semibold text-terracotta">{formatMoney(p.price_minor)} / {p.period} · {p.discount_percent}% off</p>
                {sub ? (
                  <div className="mt-auto space-y-2">
                    <p className="text-sm text-forest">Yours until {formatTime(sub.period_end)}. Catalogue orders at this store take the discount automatically. Quotes stay at the seller's price.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => act(`/api/subscriptions/${sub.id}/renew`)}>Renew from wallet</Button>
                      <Button size="sm" variant="ghost" onClick={() => act(`/api/subscriptions/${sub.id}/cancel`)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button className="mt-auto" onClick={() => act(`/api/plans/${p.id}/subscribe`)}>Subscribe with campus wallet</Button>
                )}
              </Card>
            </li>
          )
        })}
      </ul>
      {error && <Notice tone="bad">{error}</Notice>}
    </div>
  )
}

export function PlanEditor({ storeId, plans, onSaved }: { storeId: string; plans: Plan[]; onSaved: () => void }) {
  const [f, setF] = useState({ title: '', description: '', price: '', period: 'month' as 'week' | 'month', discount: '10' })
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    try {
      await api(`/api/stores/${storeId}/plans`, {
        method: 'POST',
        body: {
          title: f.title, description: f.description, price_minor: rupeesToMinor(f.price),
          period: f.period, discount_percent: Number(f.discount), active: true,
        },
      })
      setF({ title: '', description: '', price: '', period: 'month', discount: '10' })
      setMsg({ tone: 'ok', text: 'Plan is live. Buyers pay the first period from their campus wallet.' })
      onSaved()
    } catch (err) {
      setMsg({ tone: 'bad', text: err instanceof Error ? err.message : 'Could not save the plan' })
    }
  }
  const toggle = async (p: Plan) => {
    await api(`/api/plans/${p.id}`, { method: 'PATCH', body: { active: !p.active } })
    onSaved()
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-taupe">A plan is a meal club, print bundle, or lending desk membership. It discounts catalogue orders while it is active. There is no card charge and no silent renewal. Up to six plans per store.</p>
      <ul className="space-y-2">
        {plans.map((p) => (
          <li key={p.id}>
            <Card className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{p.title} <span className="text-sm font-normal text-taupe">{p.active ? 'open' : 'paused'}</span></p>
                <p className="text-sm text-taupe">{formatMoney(p.price_minor)} / {p.period} · {p.discount_percent}% off</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => toggle(p)}>{p.active ? 'Pause' : 'Reopen'}</Button>
            </Card>
          </li>
        ))}
      </ul>
      <Card>
        <form onSubmit={save} className="space-y-3">
          <h3 className="font-bold">New plan</h3>
          <Field label="Name"><Input required minLength={2} maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Weekday lunch club" /></Field>
          <Field label="What members get"><Textarea className="min-h-16" maxLength={500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="10% off the menu. Printing quotes are excluded." /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Price (₹)"><Input required type="number" min={1} step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
            <Field label="Period"><Select value={f.period} onChange={(e) => setF({ ...f, period: e.target.value as 'week' | 'month' })}><option value="week">7 days</option><option value="month">30 days</option></Select></Field>
            <Field label="Discount %"><Input required type="number" min={5} max={30} value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} /></Field>
          </div>
          <Button type="submit">Publish plan</Button>
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        </form>
      </Card>
      <p className="text-sm text-taupe">Members manage renewal from the store page or their <Link className="text-terracotta underline" to="/account">account</Link>.</p>
    </div>
  )
}
