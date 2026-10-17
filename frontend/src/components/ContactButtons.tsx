import { Flag, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Notice } from './States'
import { Button } from './ui/button'
import { Input } from './ui/input'

export function MessageButton({ storeId, orderId, productId, label = 'Message seller' }: { storeId: string; orderId?: string; productId?: string; label?: string }) {
  const nav = useNavigate()
  const { user } = useAuth()
  const [err, setErr] = useState('')
  const go = async () => {
    if (!user) return nav('/login')
    try {
      const c = await api<{ id: string }>('/api/chat/conversations', { method: 'POST', body: { store_id: storeId, order_id: orderId, product_id: productId } })
      nav(`/inbox?c=${c.id}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start the conversation')
    }
  }
  return (
    <>
      <Button variant="secondary" onClick={go}><MessageSquare className="h-4 w-4" aria-hidden /> {label}</Button>
      {err && <Notice tone="bad">{err}</Notice>}
    </>
  )
}

export function ReportButton({ targetType, targetId }: { targetType: 'store' | 'product' | 'conversation' | 'order'; targetId: string }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  if (!user) return null
  const submit = async () => {
    try {
      await api('/api/reports', { method: 'POST', body: { target_type: targetType, target_id: targetId, reason } })
      setMsg({ tone: 'ok', text: 'Report sent. A moderator will review it.' })
      setOpen(false)
    } catch (e) {
      setMsg({ tone: 'bad', text: e instanceof Error ? e.message : 'Report failed' })
    }
  }
  return (
    <div className="space-y-2">
      <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}><Flag className="h-4 w-4" aria-hidden /> Report</Button>
      {open && (
        <div className="flex gap-2">
          <Input aria-label="Reason for report" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What is wrong?" />
          <Button size="sm" disabled={reason.trim().length < 3} onClick={submit}>Send</Button>
        </div>
      )}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </div>
  )
}
