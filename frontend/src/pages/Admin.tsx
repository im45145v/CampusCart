import { useState } from 'react'
import { Empty, ErrorState, Loading, Notice } from '@/components/States'
import { Badge, statusTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { cn, formatTime } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import type { Message, Report, Store, User } from '@/lib/types'

type AdminUser = User & { is_active: boolean }
interface Audit { id: string; actor_id: string; action: string; target_type: string; target_id: string; created_at: string }

const TABS = ['Reports', 'Users', 'Stores', 'Audit'] as const

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
      {data?.map((u) => <Card key={u.id} className="flex items-center justify-between"><div><p className="font-semibold">{u.name} <span className="text-sm font-normal text-taupe">{u.email}</span></p><p className="text-xs text-taupe">{u.roles.join(', ')}</p></div><Button size="sm" variant={u.is_active ? 'secondary' : 'primary'} onClick={() => toggle(u)}>{u.is_active ? 'Deactivate' : 'Reactivate'}</Button></Card>)}
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
      {data?.map((s) => <Card key={s.id} className="flex items-center justify-between"><p className="font-semibold">{s.name} <Badge tone={statusTone(s.status)}>{s.status}</Badge></p><Button size="sm" variant="secondary" onClick={() => toggle(s)}>{s.status === 'active' ? 'Suspend' : 'Reactivate'}</Button></Card>)}
      {err && <Notice tone="bad">{err}</Notice>}
    </div>
  )
}

function AuditLog() {
  const { data, loading, error, reload } = useFetch<Audit[]>('/api/admin/audit')
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-left text-sm"><thead><tr><th className="p-1">When</th><th>Action</th><th>Target</th><th>Actor</th></tr></thead>
        <tbody>{data?.map((a) => <tr key={a.id} className="border-t border-line"><td className="p-1">{formatTime(a.created_at)}</td><td>{a.action}</td><td>{a.target_type} {a.target_id.slice(0, 8)}</td><td>{a.actor_id.slice(0, 8)}</td></tr>)}</tbody></table>
    </Card>
  )
}

export default function Admin() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Reports')
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Administration</h1>
      <div role="tablist" className="flex gap-1 border-b border-line">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('rounded-t-lg px-4 py-2 text-sm font-semibold', tab === t ? 'bg-forest text-white' : 'text-forest hover:bg-forest/10')}>{t}</button>)}
      </div>
      {tab === 'Reports' && <Reports />}
      {tab === 'Users' && <Users />}
      {tab === 'Stores' && <Stores />}
      {tab === 'Audit' && <AuditLog />}
    </div>
  )
}
