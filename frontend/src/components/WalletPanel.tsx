import { useState, type FormEvent } from 'react'
import { ErrorState, Loading, Notice } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatMoney, formatTime, rupeesToMinor } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import type { Wallet, WalletEntry } from '@/lib/types'

const REASON: Record<string, string> = {
  topup: 'Added funds', withdrawal: 'Payout request', order_payment: 'Order payment',
  order_refund: 'Order refund', order_earning: 'Sale earnings', subscription: 'Plan started',
  subscription_renew: 'Plan renewed', subscription_refund: 'Plan refund', reversal: 'Top-up reversed',
  withdrawal_return: 'Payout returned',
}

function MoneyForm({ kind, onDone }: { kind: 'add' | 'remove'; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'campus_desk' | 'reference'>('campus_desk')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    const amount_minor = rupeesToMinor(amount)
    try {
      const entry = await api<WalletEntry>(kind === 'add' ? '/api/me/wallet/add' : '/api/me/wallet/remove', {
        method: 'POST',
        body: kind === 'add' ? { amount_minor, method, note } : { amount_minor, note },
      })
      setAmount('')
      setNote('')
      setMsg({
        tone: 'ok',
        text: kind === 'add'
          ? `Added ${formatMoney(entry.amount_minor)}. This is a campus credit, not a bank transfer.`
          : `Payout of ${formatMoney(entry.amount_minor)} is requested. Staff will mark it paid.`,
      })
      onDone()
    } catch (err) {
      setMsg({ tone: 'bad', text: err instanceof Error ? err.message : 'Could not update the wallet' })
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="font-bold text-forest">{kind === 'add' ? 'Add funds' : 'Remove funds'}</h3>
      <Field label="Amount (₹)" hint={kind === 'add' ? 'Between ₹10 and ₹2,000. Daily cap ₹5,000.' : 'At least ₹10. The amount leaves your spendable balance now.'}>
        <Input required type="number" min={kind === 'add' ? 10 : 10} max={kind === 'add' ? 2000 : undefined} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      {kind === 'add' && (
        <Field label="How you loaded it" hint="CampusCart does not check UPI or a bank. Record only what the desk already accepted.">
          <Select value={method} onChange={(e) => setMethod(e.target.value as 'campus_desk' | 'reference')}>
            <option value="campus_desk">Handed cash at the campus desk</option>
            <option value="reference">Desk gave me a reference</option>
          </Select>
        </Field>
      )}
      <Field label={kind === 'add' ? 'Note or reference' : 'How should the desk pay you?'} hint={kind === 'remove' ? 'For example: hostel B desk, Friday after 4.' : undefined}>
        <Textarea className="min-h-16" maxLength={200} required={kind === 'remove' || method === 'reference'} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button type="submit">{kind === 'add' ? 'Add to wallet' : 'Request payout'}</Button>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </form>
  )
}

export function WalletPanel() {
  const wallet = useFetch<Wallet>('/api/me/wallet')
  const { refresh } = useAuth()
  const reload = () => { void wallet.reload(); void refresh() }
  if (wallet.loading) return <Loading />
  if (wallet.error || !wallet.data) return <ErrorState message={wallet.error ?? 'Wallet unavailable'} onRetry={wallet.reload} />
  return (
    <div className="space-y-4">
      <Card className="bg-forest text-white">
        <p className="text-sm text-white/80">Campus wallet</p>
        <p className="font-heading text-3xl font-extrabold text-white">{formatMoney(wallet.data.balance_minor)}</p>
        <p className="mt-2 max-w-xl text-sm text-white/80">Spendable campus credits for orders and seller plans. Buyer top-ups and seller earnings share this balance. Karma stays separate, and nothing here is a bank payment.</p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><MoneyForm kind="add" onDone={reload} /></Card>
        <Card><MoneyForm kind="remove" onDone={reload} /></Card>
      </div>
      <Card>
        <h3 className="mb-2 font-bold">Ledger</h3>
        {wallet.data.entries.length === 0 ? <p className="text-sm text-taupe">No movements yet.</p> : (
          <ul className="divide-y divide-line text-sm">
            {wallet.data.entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <div>
                  <p className="font-medium">{REASON[e.reason] ?? e.reason} <span className="text-taupe">· {e.status.replace('_', ' ')}</span></p>
                  <p className="text-xs text-taupe">{formatTime(e.created_at)}{e.note ? ` · ${e.note}` : ''}</p>
                </div>
                <p className={e.direction === 'credit' ? 'font-semibold text-forest' : 'font-semibold text-terracotta'}>
                  {e.direction === 'credit' ? '+' : '−'}{formatMoney(e.amount_minor)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
