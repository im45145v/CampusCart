import { useEffect, useState, type FormEvent } from 'react'
import { ErrorState, Loading, Notice } from '@/components/States'
import { useToast } from '@/components/Toast'
import { Badge, statusTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { openPaymentPage } from '@/lib/payment'
import { formatMoney, formatTime, rupeesToMinor } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import type { Wallet, WalletCheckout, WalletEntry } from '@/lib/types'

const REASON: Record<string, string> = {
  topup: 'Top-up', withdrawal: 'Payout', order_payment: 'Order payment',
  order_refund: 'Order refund', order_earning: 'Sale earnings', subscription: 'Plan started',
  subscription_renew: 'Plan renewed', subscription_refund: 'Plan refund', reversal: 'Top-up reversed',
  withdrawal_return: 'Payout returned',
}

const STATUS: Record<string, string> = {
  requested: 'Requested', posted: 'In balance', paid: 'Paid', returned: 'Returned',
  reversed: 'Reversed', rejected: 'Declined', expired: 'Expired',
}

function entryDetail(entry: WalletEntry): string {
  if (entry.reason === 'topup' && entry.status === 'requested') {
    return 'Waiting for YouPI to confirm the UPI payment. This page does not add the credits.'
  }
  if (entry.reason === 'topup' && entry.status === 'expired') return 'Checkout expired. Balance unchanged.'
  if (entry.reason === 'topup' && entry.status === 'rejected') return 'Declined. Balance unchanged.'
  if (entry.reason === 'withdrawal' && entry.status === 'requested') {
    return 'Requested. This amount has left your spendable balance.'
  }
  if (entry.reason === 'withdrawal' && entry.status === 'paid') return 'Paid by the desk.'
  if (entry.reason === 'withdrawal' && entry.status === 'returned') return 'Returned to your spendable balance.'
  return ''
}

function MoneyForm({
  kind, onDone, payoutWaiting, checkoutReady,
}: {
  kind: 'add' | 'remove'
  onDone: () => void
  payoutWaiting?: boolean
  checkoutReady?: boolean
}) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || payoutWaiting) return
    setMsg(null)
    setBusy(true)
    const amount_minor = rupeesToMinor(amount)
    // Open during the click. A window opened after the request returns is blocked.
    const popup = kind === 'add' ? window.open('', '_blank') : null
    try {
      if (kind === 'remove') {
        const entry = await api<WalletEntry>('/api/me/wallet/remove', {
          method: 'POST', body: { amount_minor, note },
        })
        setAmount('')
        setNote('')
        const text = `Payout of ${formatMoney(entry.amount_minor)} is requested. It has left your spendable balance until staff mark it paid or return it.`
        setMsg({ tone: 'ok', text })
        toast('ok', text)
      } else {
        const entry = await api<WalletCheckout>('/api/me/wallet/checkout', {
          method: 'POST', body: { amount_minor },
        })
        const url = entry.checkout_url ?? null
        setCheckoutUrl(url)
        if (!url || !openPaymentPage(url, popup)) {
          popup?.close()
          const text = 'YouPI did not return a checkout link.'
          setMsg({ tone: 'bad', text })
          toast('bad', text)
        } else {
          const text = `Payment page opened for ${formatMoney(entry.amount_minor)}. Credits appear here only after YouPI confirms the payment.`
          setMsg({ tone: 'ok', text })
          toast('ok', text)
        }
      }
      onDone()
    } catch (err) {
      popup?.close()
      const text = err instanceof Error ? err.message : 'Could not update the wallet'
      setMsg({ tone: 'bad', text })
      toast('bad', text)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="font-semibold">{kind === 'add' ? 'Add funds' : 'Request a payout'}</h3>
      {kind === 'add' ? (
        <div className="space-y-2 rounded-xl border border-line bg-ivory px-3 py-3 text-sm">
          <p>Choose an amount. YouPI opens a QR and UPI app links. Pay from your own UPI app.</p>
          <p className="text-taupe">UniCart adds the credits only after it verifies YouPI’s signed confirmation. Closing the payment page does not add them.</p>
        </div>
      ) : (
        <p className="text-sm text-taupe">A payout request leaves your spendable balance now. Staff mark it paid when the desk hands the money over, or return it to the wallet.</p>
      )}
      {kind === 'remove' && payoutWaiting ? (
        <Notice tone="ok">A payout is already requested. Wait until the desk marks it paid or returns it before you request another.</Notice>
      ) : (
        <>
          <Field label="Amount (₹)" hint={kind === 'add' ? 'Between ₹10 and ₹2,000. Daily cap ₹5,000, including a checkout that is still open.' : 'At least ₹10. The amount leaves your spendable balance now.'}>
            <Input required type="number" min={10} max={kind === 'add' ? 2000 : undefined} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          {kind === 'remove' && (
            <Field label="How should the desk pay you?" hint="For example: hostel B desk, Friday after 4.">
              <Textarea className="min-h-16" maxLength={200} required value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          )}
          <Button type="submit" disabled={busy || (kind === 'add' && checkoutReady === false)}>
            {busy ? 'Please wait…' : kind === 'add' ? 'Continue to UPI' : 'Request payout'}
          </Button>
          {kind === 'add' && checkoutReady === false && <p className="text-sm text-taupe">UPI checkout is not configured yet.</p>}
          {checkoutUrl && (
            <Button asChild>
              <a href={checkoutUrl} target="_blank" rel="noreferrer">Open UPI checkout</a>
            </Button>
          )}
        </>
      )}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </form>
  )
}

export function WalletPanel() {
  const wallet = useFetch<Wallet>('/api/me/wallet')
  const { refresh } = useAuth()
  const reload = () => { void wallet.reloadQuiet(); void refresh() }
  const pendingMinor = (wallet.data?.entries ?? [])
    .filter((e) => e.reason === 'topup' && e.status === 'requested')
    .reduce((sum, e) => sum + e.amount_minor, 0)
  useEffect(() => {
    if (pendingMinor <= 0) return
    const timer = window.setInterval(() => { void wallet.reloadQuiet(); void refresh() }, 4000)
    return () => window.clearInterval(timer)
  }, [pendingMinor, refresh, wallet])
  if (wallet.loading) return <Loading />
  if (wallet.error || !wallet.data) return <ErrorState message={wallet.error ?? 'Wallet unavailable'} onRetry={wallet.reload} />
  const openPayout = wallet.data.entries.find((e) => e.reason === 'withdrawal' && e.status === 'requested')
  return (
    <div className="space-y-4">
      <Card className="bg-forest text-white">
        <p className="text-sm text-white/80">Spendable balance</p>
        <p className="font-heading text-3xl font-extrabold tracking-tight text-white">{formatMoney(wallet.data.balance_minor)}</p>
        <p className="mt-2 max-w-xl text-sm text-white/85">Campus credits for orders and stall plans. This balance is not a bank account. A top-up stays requested until YouPI confirms the UPI payment. Add ₹10–₹2,000 at a time, up to ₹5,000 a day. A payout request starts at ₹10 and leaves this balance until staff mark it paid or return it.</p>
        {pendingMinor > 0 && <p className="mt-2 text-sm text-white/90">Waiting for YouPI: {formatMoney(pendingMinor)}. Not spendable yet.</p>}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><MoneyForm kind="add" checkoutReady={wallet.data.checkout === 'ready'} onDone={reload} /></Card>
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
