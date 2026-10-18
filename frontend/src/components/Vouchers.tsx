import { useState, type FormEvent } from 'react'
import { Notice } from '@/components/States'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/input'
import { api } from '@/lib/api'
import { rupeesToMinor } from '@/lib/utils'
import type { Voucher } from '@/lib/types'

const AUDIENCE = [
  ['anyone', 'Anyone'],
  ['first_order', 'First order on campus'],
  ['first_store_order', 'First order at this store'],
  ['new_account', 'New account'],
] as const

export function OfferList({ vouchers }: { vouchers: Voucher[] }) {
  if (!vouchers.length) return null
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {vouchers.map((v) => (
        <li key={v.id}>
          <Card className="space-y-1">
            <p className="font-bold">{v.title}</p>
            <p className="font-mono text-sm tracking-wide text-terracotta">{v.code}</p>
            <p className="text-sm text-taupe">{v.summary}</p>
          </Card>
        </li>
      ))}
    </ul>
  )
}

export function VoucherDesk({
  createUrl, vouchers, onSaved, campus,
}: {
  createUrl: string
  vouchers: Voucher[]
  onSaved: () => void
  campus?: boolean
}) {
  const [f, setF] = useState({
    code: '', title: '', kind: 'percent', value: '10', audience: 'anyone', days: '14',
    min: '', items: '1', applies: 'catalogue', category: '', payment: '', maxUses: '', cap: '',
  })
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    const kind = f.kind === 'amount' ? 'amount' : 'percent'
    try {
      await api(createUrl, {
        method: 'POST',
        body: {
          code: f.code, title: f.title, kind, audience: f.audience,
          percent: kind === 'percent' ? Number(f.value) : null,
          amount_minor: kind === 'amount' ? rupeesToMinor(f.value) : null,
          applies_to: f.applies, min_items: Number(f.items) || 1,
          min_subtotal_minor: f.min ? rupeesToMinor(f.min) : 0,
          max_discount_minor: kind === 'percent' && f.cap ? rupeesToMinor(f.cap) : null,
          new_account_days: Number(f.days) || 14,
          categories: f.category.trim() ? [f.category.trim()] : [],
          payment_methods: f.payment ? [f.payment] : [],
          max_redemptions: f.maxUses ? Number(f.maxUses) : null,
        },
      })
      setF({ ...f, code: '', title: '' })
      setMsg({ tone: 'ok', text: 'Code is live. Checkout applies it on the server.' })
      onSaved()
    } catch (err) {
      setMsg({ tone: 'bad', text: err instanceof Error ? err.message : 'Could not save the code' })
    }
  }
  const pause = async (v: Voucher) => {
    await api(`/api/vouchers/${v.id}`, { method: 'PATCH', body: { active: !v.active } })
    onSaved()
  }
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h3 className="text-lg font-bold">{campus ? 'Campus code' : 'Store code'}</h3>
        <p className="text-sm text-taupe">
          {campus
            ? 'Works at every open stall. You receive what the student pays.'
            : 'You receive what the student pays. Pause a code to stop new uses.'}
        </p>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <Field label="Code"><Input required minLength={4} maxLength={16} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="FIRSTBITE" /></Field>
          <Field label="Name"><Input required minLength={2} maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="First order on campus" /></Field>
          <Field label="Offer">
            <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              <option value="percent">Percent off</option>
              <option value="amount">Fixed rupees off</option>
            </Select>
          </Field>
          <Field label={f.kind === 'amount' ? 'Rupees off' : 'Percent (1–80)'}>
            <Input required inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
          </Field>
          <Field label="Who can use it">
            <Select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
              {AUDIENCE.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </Select>
          </Field>
          {f.audience === 'new_account' && (
            <Field label="Account age, up to (days)"><Input inputMode="numeric" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /></Field>
          )}
          <Field label="Minimum order (₹)" hint="Blank means no minimum. Checked on the covered items, before the code.">
            <Input inputMode="decimal" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} />
          </Field>
          <Field label="Minimum covered items"><Input inputMode="numeric" value={f.items} onChange={(e) => setF({ ...f, items: e.target.value })} /></Field>
          <Field label="What it covers">
            <Select value={f.applies} onChange={(e) => setF({ ...f, applies: e.target.value })}>
              <option value="catalogue">Food and goods (not priced print jobs)</option>
              <option value="priced">Food, goods, and priced print jobs</option>
            </Select>
          </Field>
          <Field label="Only this category" hint="Blank covers every category. Must match the listing category.">
            <Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="snacks" />
          </Field>
          <Field label="Payment">
            <Select value={f.payment} onChange={(e) => setF({ ...f, payment: e.target.value })}>
              <option value="">Any accepted option</option>
              <option value="pay_on_pickup">Pay on pickup</option>
              <option value="manual_confirmation">Pay the seller directly</option>
              <option value="campus_wallet">Campus wallet</option>
            </Select>
          </Field>
          <Field label="Times it can be used" hint="Blank means no overall cap. Each student can use a code once. Cancelling the order frees that use.">
            <Input inputMode="numeric" value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} />
          </Field>
          {f.kind === 'percent' && (
            <Field label="Cap the discount (₹)" hint="Blank means the percent can apply to the whole covered total.">
              <Input inputMode="decimal" value={f.cap} onChange={(e) => setF({ ...f, cap: e.target.value })} />
            </Field>
          )}
          <div className="sm:col-span-2"><Button type="submit">Save code</Button></div>
        </form>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </Card>
      <ul className="space-y-2">
        {vouchers.map((v) => (
          <li key={v.id}>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold">{v.title} <span className="font-mono text-terracotta">{v.code}</span></p>
                <p className="text-sm text-taupe">{v.summary}</p>
                {v.redeemed !== undefined && <p className="text-xs text-taupe">Used {v.redeemed}{v.max_redemptions ? ` of ${v.max_redemptions}` : ''} times right now. A cancel frees a use.</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={v.active ? 'ok' : 'neutral'}>{v.active ? 'Live' : 'Paused'}</Badge>
                <Button variant="secondary" size="sm" onClick={() => void pause(v)}>{v.active ? 'Pause' : 'Turn on'}</Button>
              </div>
            </Card>
          </li>
        ))}
        {!vouchers.length && <p className="text-sm text-taupe">No codes yet.</p>}
      </ul>
    </div>
  )
}
