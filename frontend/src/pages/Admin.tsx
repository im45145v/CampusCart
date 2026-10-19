import { useState } from 'react'
import { Empty, ErrorState, Loading, Notice } from '@/components/States'
import { Badge, statusTone } from '@/components/ui/badge'
import { tabClass } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { formatMoney, formatTime } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import { VoucherDesk } from '@/components/Vouchers'
import type { Message, Report, Store, User, Voucher, WalletEntry } from '@/lib/types'

type AdminUser = User & { is_active: boolean }
interface Audit { id: string; actor_id: string; action: string; target_type: string; target_id: string; created_at: string }

const TABS = ['Applications', 'Reports', 'Funds', 'Offers', 'Users', 'Stores', 'Audit'] as const

function Applications() {
  const { data, loading, error, reload } = useFetch<Store[]>('/api/admin/stores', { status: 'pending' })
  const [reason, setReason] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [deciding, setDeciding] = useState('')
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  const decide = async (id: string, decision: 'approved' | 'rejected') => {
    if (deciding) return
    const note = (reason[id] ?? '').trim()
    if (note.length < 3) {
      setErr('Write at least 3 characters. The seller sees this note if you reject the stall.')
      return
    }
    setErr('')
    setDeciding(id)
    try {
      await api(`/api/admin/stores/${id}/decision`, { method: 'POST', body: { decision, reason: note } })
      await reload()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed') }
    finally { setDeciding('') }
  }
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">Stall applications</h2>
        <p className="text-sm text-taupe">Pending stalls stay hidden. Students cannot see them or place an order until you approve. A rejected stall returns to this queue after the seller edits it and submits again. Nothing here is approved automatically.</p>
      </div>
      {!data?.length ? <Empty title="No stall applications waiting">When a seller submits again, the stall shows up here as pending.</Empty> : (
        <ul className="space-y-3">
          {data.map((s) => (
            <li key={s.id}>
              <Card className="space-y-2">
                <p className="font-semibold">{s.name} <Badge tone="warn">Pending</Badge> <span className="text-sm font-normal text-taupe">{s.category}</span></p>
                <p className="text-sm text-taupe">{s.description}</p>
                {s.pickup_details && <p className="text-sm">Pickup: {s.pickup_details}</p>}
                {s.created_at && <p className="text-xs text-taupe">Submitted {formatTime(s.created_at)}</p>}
                <div className="flex flex-wrap gap-2">
                  <Input aria-label={`Note for ${s.name}`} className="min-w-60 flex-1" placeholder="Why you approve or reject it (required)" value={reason[s.id] ?? ''} onChange={(e) => setReason({ ...reason, [s.id]: e.target.value })} />
                  <Button disabled={!!deciding || (reason[s.id] ?? '').trim().length < 3} onClick={() => decide(s.id, 'approved')}>Approve</Button>
                  <Button variant="secondary" disabled={!!deciding || (reason[s.id] ?? '').trim().length < 3} onClick={() => decide(s.id, 'rejected')}>Reject</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {err && <Notice tone="bad">{err}</Notice>}
    </div>
  )
}

function Reports() {
  const { data, loading, error, reload } = useFetch<Report[]>('/api/admin/reports')
  const [resolution, setResolution] = useState<Record<string, string>>({})
  const [thread, setThread] = useState<Message[] | null>(null)
  const [err, setErr] = useState('')
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data?.length) return <Empty title="No reports" />
  const resolve = async (id: string, status: 'resolved' | 'dismissed') => {
    setErr('')
    try { await api(`/api/admin/reports/${id}/resolve`, { method: 'POST', body: { status, resolution: resolution[id] ?? '' } }); await reload() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed') }
  }
  return (
    <ul className="space-y-3">
      {data.map((r) => (
        <li key={r.id}>
          <Card className="space-y-2">
            <p><Badge tone={statusTone(r.status)}>{r.status}</Badge> <strong>{r.target_type}</strong> <span className="font-mono text-xs">{r.target_id}</span> · {formatTime(r.created_at)}</p>
            <p>{r.reason}</p>
            {r.status === 'open' ? (
              <div className="flex flex-wrap gap-2">
                <Input aria-label="Resolution notes" className="min-w-60 flex-1" placeholder="Resolution notes" value={resolution[r.id] ?? ''} onChange={(e) => setResolution({ ...resolution, [r.id]: e.target.value })} />
                {r.target_type === 'conversation' && <Button variant="secondary" onClick={async () => setThread(await api<Message[]>(`/api/admin/reports/${r.id}/conversation`))}>View conversation (audited)</Button>}
                <Button onClick={() => resolve(r.id, 'resolved')}>Resolve</Button>
                <Button variant="secondary" onClick={() => resolve(r.id, 'dismissed')}>Dismiss</Button>
              </div>
            ) : <p className="text-sm text-taupe">Resolution: {r.resolution}</p>}
          </Card>
        </li>
      ))}
      {thread && <Card><h3 className="font-bold">Reported conversation</h3>{thread.map((m) => <p key={m.id} className="text-sm"><span className="font-mono text-xs">{m.sender_id.slice(0, 6)}</span> {m.text}</p>)}<Button variant="ghost" size="sm" onClick={() => setThread(null)}>Close</Button></Card>}
      {err && <Notice tone="bad">{err}</Notice>}
    </ul>
  )
}

function Users() {
  const { data, loading, error, reload } = useFetch<AdminUser[]>('/api/admin/users')
  const [err, setErr] = useState('')
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  const toggle = async (u: AdminUser) => {
    const reason = window.prompt(`Reason to ${u.is_active ? 'deactivate' : 'reactivate'} ${u.name}?`)
    if (!reason) return
    try { await api(`/api/admin/users/${u.id}/active`, { method: 'POST', params: { active: !u.is_active }, body: { reason } }); await reload() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed') }
  }
  return (
    <div className="space-y-2">
      {data?.map((u) => <Card key={u.id} className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{u.name} <span className="text-sm font-normal text-taupe">{u.email}</span></p><p className="text-xs text-taupe">{u.roles.join(', ')}</p></div><Button size="sm" variant={u.is_active ? 'secondary' : 'primary'} onClick={() => toggle(u)}>{u.is_active ? 'Deactivate' : 'Reactivate'}</Button></Card>)}
      {err && <Notice tone="bad">{err}</Notice>}
    </div>
  )
}

function Stores() {
  const { data, loading, error, reload } = useFetch<Store[]>('/api/admin/stores')
  const [err, setErr] = useState('')
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  const toggle = async (s: Store) => {
    const reason = window.prompt(`Reason to ${s.status === 'active' ? 'suspend' : 'reactivate'} ${s.name}?`)
    if (!reason) return
    try { await api(`/api/admin/stores/${s.id}/status`, { method: 'POST', params: { suspended: s.status === 'active' }, body: { reason } }); await reload() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed') }
  }
  return (
    <div className="space-y-2">
      {data?.map((s) => <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">{s.name} <Badge tone={statusTone(s.status)}>{s.status}</Badge></p>{s.status === 'active' || s.status === 'suspended' ? <Button size="sm" variant="secondary" onClick={() => toggle(s)}>{s.status === 'active' ? 'Suspend' : 'Reactivate'}</Button> : <p className="text-sm text-taupe">{s.status === 'pending' ? 'Waiting in Applications' : 'Seller can submit again'}</p>}</Card>)}
      {err && <Notice tone="bad">{err}</Notice>}
    </div>
  )
}

function Funds() {
  const payouts = useFetch<WalletEntry[]>('/api/admin/wallet', { status: 'requested', reason: 'withdrawal' })
  const waiting = useFetch<WalletEntry[]>('/api/admin/wallet', { status: 'requested', reason: 'topup' })
  const posted = useFetch<WalletEntry[]>('/api/admin/wallet', { status: 'posted', reason: 'topup' })
  const [err, setErr] = useState('')
  const [pending, setPending] = useState('')
  const act = async (id: string, action: 'paid' | 'return' | 'reverse' | 'approve' | 'reject') => {
    if (pending) return
    setErr('')
    setPending(id + action)
    try {
      await api(`/api/admin/wallet/${id}/${action}`, { method: 'POST' })
      await payouts.reload()
      await waiting.reload()
      await posted.reload()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed') }
    finally { setPending('') }
  }
  if (payouts.loading || waiting.loading || posted.loading) return <Loading />
  if (payouts.error) return <ErrorState message={payouts.error} onRetry={payouts.reload} />
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">Payout requests</h2>
      <p className="text-sm text-taupe">Status: requested. The amount has already left the student&apos;s spendable balance. Mark paid when the desk hands the money over, or return it to the wallet. A second click does not pay it twice.</p>
      {payouts.data?.length ? (
        <ul className="space-y-2">
          {payouts.data.map((e) => (
            <li key={e.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{formatMoney(e.amount_minor)} <Badge tone="warn">Requested</Badge></p>
                  <p className="text-xs text-taupe">{formatTime(e.created_at)} · {e.note || 'No note'} · user {(e.user_id ?? '').slice(0, 8)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={!!pending} onClick={() => act(e.id, 'paid')}>Mark paid</Button>
                  <Button size="sm" variant="secondary" disabled={!!pending} onClick={() => act(e.id, 'return')}>Return to wallet</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-taupe">No payouts waiting.</p>}
      <h2 className="pt-2 text-lg font-bold">Older desk top-ups</h2>
      <p className="text-sm text-taupe">New top-ups are confirmed by YouPI. This list is only a desk request that was still waiting. Approving a YouPI checkout does nothing.</p>
      {waiting.data?.filter((e) => e.method !== 'youpi').length ? (
        <ul className="space-y-2">
          {waiting.data.filter((e) => e.method !== 'youpi').map((e) => (
            <li key={e.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{formatMoney(e.amount_minor)} <Badge tone="warn">Requested</Badge></p>
                  <p className="text-xs text-taupe">{formatTime(e.created_at)} · UPI transaction {e.transaction_id || 'missing'} · {e.note || 'No note'} · user {(e.user_id ?? '').slice(0, 8)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={!!pending} onClick={() => act(e.id, 'approve')}>Approve</Button>
                  <Button size="sm" variant="secondary" disabled={!!pending} onClick={() => act(e.id, 'reject')}>Decline</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-taupe">No top-ups waiting.</p>}
      <h2 className="pt-2 text-lg font-bold">Confirmed top-ups</h2>
      <p className="text-sm text-taupe">Status: in the spendable balance. Reverse one only if that top-up should not have been credited. The balance is debited, and it fails if those credits were already spent.</p>
      {posted.data?.length ? (
        <ul className="space-y-2">
          {posted.data.map((e) => (
            <li key={e.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{formatMoney(e.amount_minor)} <Badge tone="ok">In balance</Badge></p>
                  <p className="text-xs text-taupe">{formatTime(e.created_at)} · UPI transaction {e.transaction_id || 'none'} · {e.note || 'No note'} · user {(e.user_id ?? '').slice(0, 8)}</p>
                </div>
                <Button size="sm" variant="secondary" disabled={!!pending} onClick={() => act(e.id, 'reverse')}>Reverse</Button>
              </Card>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-taupe">No confirmed top-ups.</p>}
      {err && <Notice tone="bad">{err}</Notice>}
    </div>
  )
}

function Offers() {
  const { data, loading, error, reload } = useFetch<Voucher[]>('/api/admin/vouchers')
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  return <VoucherDesk campus createUrl="/api/admin/vouchers" vouchers={data ?? []} onSaved={() => void reload()} />
}

function AuditLog() {
  const { data, loading, error, reload } = useFetch<Audit[]>('/api/admin/audit')
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="text-taupe"><tr><th className="px-4 py-3 font-medium">When</th><th className="px-4 py-3 font-medium">Action</th><th className="px-4 py-3 font-medium">Target</th><th className="px-4 py-3 font-medium">Actor</th></tr></thead>
        <tbody>{data?.map((a) => <tr key={a.id} className="border-t border-line"><td className="px-4 py-3">{formatTime(a.created_at)}</td><td className="px-4 py-3">{a.action}</td><td className="px-4 py-3">{a.target_type} {a.target_id.slice(0, 8)}</td><td className="px-4 py-3">{a.actor_id.slice(0, 8)}</td></tr>)}</tbody>
      </table>
    </Card>
  )
}

export default function Admin() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Applications')
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Administration</h1>
      <div role="tablist" aria-label="Administration" className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={tabClass(tab === t)}>{t}</button>)}
      </div>
      {tab === 'Applications' && <Applications />}
      {tab === 'Reports' && <Reports />}
      {tab === 'Funds' && <Funds />}
      {tab === 'Offers' && <Offers />}
      {tab === 'Users' && <Users />}
      {tab === 'Stores' && <Stores />}
      {tab === 'Audit' && <AuditLog />}
    </div>
  )
}
