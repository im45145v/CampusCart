import { useState, type FormEvent } from 'react'
import { ErrorState, Loading, Notice } from '@/components/States'
import { useToast } from '@/components/Toast'
import { Badge, statusTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatMoney, formatTime, rupeesToMinor } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import type { Wallet, WalletEntry } from '@/lib/types'

const REASON: Record<string, string> = {
  topup: 'Top-up', withdrawal: 'Payout', order_payment: 'Order payment',
  order_refund: 'Order refund', order_earning: 'Sale earnings', subscription: 'Plan started',
  subscription_renew: 'Plan renewed', subscription_refund: 'Plan refund', reversal: 'Top-up reversed',
  withdrawal_return: 'Payout returned',
}

const STATUS: Record<string, string> = {
  requested: 'Requested', posted: 'In balance', paid: 'Paid', returned: 'Returned',
  reversed: 'Reversed', rejected: 'Declined',
}

function entryDetail(entry: WalletEntry): string {
  if (entry.reason === 'topup' && entry.status === 'requested') {
    return 'Requested. Not spendable until an admin confirms it.'
  }
  if (entry.reason === 'topup' && entry.status === 'rejected') return 'Declined. Balance unchanged.'
  if (entry.reason === 'withdrawal' && entry.status === 'requested') {
    return 'Requested. This amount has left your spendable balance.'
  }
  if (entry.reason === 'withdrawal' && entry.status === 'paid') return 'Paid by the desk.'
  if (entry.reason === 'withdrawal' && entry.status === 'returned') return 'Returned to your spendable balance.'
  return ''
}

function MoneyForm({
  kind, onDone, upiId, payoutWaiting,
}: {
  kind: 'add' | 'remove'
  onDone: () => void
  upiId?: string
  payoutWaiting?: boolean
}) {
  const [amount, setAmount] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || payoutWaiting) return
    setMsg(null)
    const txn = transactionId.trim()
    if (kind === 'add' && txn.length < 4) {
      const text = 'Enter the UPI transaction ID. An empty ID is not accepted.'
      setMsg({ tone: 'bad', text })
      toast('bad', text)
      return
    }
    setBusy(true)
    const amount_minor = rupeesToMinor(amount)
    try {
      const entry = await api<WalletEntry>(kind === 'add' ? '/api/me/wallet/add' : '/api/me/wallet/remove', {
        method: 'POST',
        body: kind === 'add'
          ? { amount_minor, method: 'upi', note, transaction_id: txn }
          : { amount_minor, note },
      })
      setAmount('')
      setNote('')
      setTransactionId('')
      const text = kind === 'remove'
        ? `Payout of ${formatMoney(entry.amount_minor)} is requested. It has left your spendable balance until staff mark it paid or return it.`
        : entry.status === 'requested'
          ? `Top-up of ${formatMoney(entry.amount_minor)} is requested. An admin has to confirm it before you can spend it. The ID you typed is not proof of payment.`
          : entry.status === 'posted'
            ? 'This transaction ID is already confirmed on your wallet.'
            : `This transaction ID was already submitted (${STATUS[entry.status] ?? entry.status}).`
      setMsg({ tone: 'ok', text })
      toast(entry.status === 'requested' || kind === 'remove' ? 'ok' : 'bad', text)
      onDone()
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Could not update the wallet'
      setMsg({ tone: 'bad', text })
      toast('bad', text)
    } finally {
      setBusy(false)
    }
  }
  const copyUpi = async () => {
    if (!upiId) return
    try {
      await navigator.clipboard.writeText(upiId)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="font-semibold">{kind === 'add' ? 'Add funds' : 'Request a payout'}</h3>
      {kind === 'add' ? (
        <div className="space-y-2 rounded-xl border border-line bg-ivory px-3 py-3 text-sm">
          <p>Pay this campus desk UPI from your own app, then paste the transaction ID here.</p>
          <p className="font-mono text-base font-semibold text-forest">{upiId || 'UPI ID unavailable'}</p>
          <p className="text-taupe">CampusCart does not check UPI or a bank. The ID you type is not proof of payment. An admin confirms the top-up before the credits can be spent.</p>
          {upiId && (
            <Button type="button" size="sm" variant="secondary" onClick={() => void copyUpi()}>
              {copied ? 'Copied' : 'Copy UPI ID'}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-taupe">A payout request leaves your spendable balance now. Staff mark it paid when the desk hands the money over, or return it to the wallet.</p>
      )}
      {kind === 'remove' && payoutWaiting ? (
        <Notice tone="ok">A payout is already requested. Wait until the desk marks it paid or returns it before you request another.</Notice>
      ) : (
        <>
          <Field label="Amount (₹)" hint={kind === 'add' ? 'Between ₹10 and ₹2,000. Daily cap ₹5,000, including requests still waiting.' : 'At least ₹10. The amount leaves your spendable balance now.'}>
            <Input required type="number" min={10} max={kind === 'add' ? 2000 : undefined} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          {kind === 'add' && (
            <Field label="UPI transaction ID" hint="Required. This is the reference from your UPI app, not a receipt CampusCart can verify.">
              <Input required minLength={4} maxLength={64} autoComplete="off" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="For example 123456789012" />
            </Field>
          )}
          <Field label={kind === 'add' ? 'Note (optional)' : 'How should the desk pay you?'} hint={kind === 'remove' ? 'For example: hostel B desk, Friday after 4.' : undefined}>
            <Textarea className="min-h-16" maxLength={200} required={kind === 'remove'} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Button type="submit" disabled={busy || (kind === 'add' && transactionId.trim().length < 4)}>
            {busy ? 'Please wait…' : kind === 'add' ? 'Request top-up' : 'Request payout'}
          </Button>
        </>
      )}
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
  const pendingMinor = wallet.data.entries
    .filter((e) => e.reason === 'topup' && e.status === 'requested')
    .reduce((sum, e) => sum + e.amount_minor, 0)
  const openPayout = wallet.data.entries.find((e) => e.reason === 'withdrawal' && e.status === 'requested')
  return (
    <div className="space-y-4">
      <Card className="bg-forest text-white">
        <p className="text-sm text-white/80">Spendable balance</p>
        <p className="font-heading text-3xl font-extrabold tracking-tight text-white">{formatMoney(wallet.data.balance_minor)}</p>
        <p className="mt-2 max-w-xl text-sm text-white/85">Campus credits for orders and stall plans. This balance is not a bank account. A top-up stays requested until an admin confirms it. Add ₹10–₹2,000 at a time, up to ₹5,000 a day. A payout request starts at ₹10 and leaves this balance until staff mark it paid or return it.</p>
        {pendingMinor > 0 && <p className="mt-2 text-sm text-white/90">Waiting for the desk: {formatMoney(pendingMinor)}. Not spendable yet.</p>}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><MoneyForm kind="add" upiId={wallet.data.upi_id} onDone={reload} /></Card>
        <Card><MoneyForm kind="remove" payoutWaiting={!!openPayout} onDone={reload} /></Card>
      </div>
      <Card>
        <h3 className="mb-2 font-semibold">Transaction history</h3>
        {wallet.data.entries.length === 0 ? <p className="text-sm text-taupe">No movements yet.</p> : (
          <ul className="divide-y divide-line text-sm">
            {wallet.data.entries.map((e) => {
              const held = (e.reason === 'topup' && e.status === 'requested') || e.status === 'rejected'
              const detail = entryDetail(e)
              return (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium">{REASON[e.reason] ?? e.reason} <Badge tone={statusTone(e.status)} className="ml-1 align-middle">{STATUS[e.status] ?? e.status.replaceAll('_', ' ')}</Badge></p>
                    <p className="text-xs text-taupe">{formatTime(e.created_at)}{e.transaction_id ? ` · Transaction ${e.transaction_id}` : ''}{e.note ? ` · ${e.note}` : ''}</p>
                    {detail && <p className="text-xs text-taupe">{detail}</p>}
                  </div>
                  <p className={held ? 'font-semibold text-taupe' : e.direction === 'credit' ? 'font-semibold text-ok' : 'font-semibold text-ink'}>
                    {held ? '' : e.direction === 'credit' ? '+' : '−'}{formatMoney(e.amount_minor)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
