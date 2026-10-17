import { WifiOff } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ReportButton } from '@/components/ContactButtons'
import { Empty, ErrorState, Loading } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useChat } from '@/lib/chat'
import { cn, formatTime } from '@/lib/utils'
import { useFetch } from '@/lib/useFetch'
import type { Conversation, Message } from '@/lib/types'

interface Page { messages: Message[]; has_more: boolean; other_read_seq: number }

function Thread({ conv }: { conv: Conversation }) {
  const { user } = useAuth()
  const chat = useChat()
  const [messages, setMessages] = useState<Message[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [text, setText] = useState('')
  const [pending, setPending] = useState<Message[]>([])
  const [otherRead, setOtherRead] = useState(conv.other_read_seq)
  const [typing, setTyping] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const bottom = useRef<HTMLDivElement>(null)
  const lastTyping = useRef(0)
  const base = `/api/chat/conversations/${conv.id}`

  const merge = useCallback((incoming: Message[]) => {
    setMessages((cur) => {
      const map = new Map(cur.map((m) => [m.seq, m]))
      incoming.forEach((m) => map.set(m.seq, m))
      return [...map.values()].sort((a, b) => a.seq - b.seq)
    })
  }, [])

  const markRead = useCallback((seq: number) => {
    if (!chat.send({ type: 'read', conversation_id: conv.id, up_to_seq: seq })) {
      void api(`${base}/read`, { method: 'POST', params: { up_to_seq: seq } }).then(chat.refreshUnread)
    }
  }, [chat, conv.id, base])

  useEffect(() => {
    setLoading(true)
    api<Page>(`${base}/messages`, { params: { limit: 30 } })
      .then((p) => { setMessages(p.messages); setHasMore(p.has_more); setOtherRead(p.other_read_seq) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [base])

  // Missed-message recovery: after a reconnect, fetch everything newer than what we hold.
  const lastSeq = messages.length ? messages[messages.length - 1].seq : 0
  const lastSeqRef = useRef(lastSeq)
  useEffect(() => { lastSeqRef.current = lastSeq }, [lastSeq])
  useEffect(() => {
    if (chat.reconnects === 0) return
    api<Page>(`${base}/messages`, { params: { after_seq: lastSeqRef.current, limit: 100 } }).then((p) => merge(p.messages)).catch(() => undefined)
  }, [chat.reconnects, base, merge])

  useEffect(() => chat.subscribe((e) => {
    if (e.type === 'message' && e.message.conversation_id === conv.id) {
      merge([e.message])
      setTyping(false)
    } else if (e.type === 'ack') {
      setPending((p) => p.filter((m) => m.client_id !== e.client_id))
      merge([e.message])
    } else if (e.type === 'typing' && e.conversation_id === conv.id) {
      setTyping(true)
      setTimeout(() => setTyping(false), 3000)
    } else if (e.type === 'read' && e.conversation_id === conv.id) {
      setOtherRead(e.up_to_seq)
    } else if (e.type === 'error' && e.client_id) {
      setPending((p) => p.filter((m) => m.client_id !== e.client_id))
      setError(e.code === 'rate_limited' ? 'You are sending messages too quickly.' : 'Message could not be sent.')
    }
  }), [chat, conv.id, merge])

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end' })
    if (lastSeq > 0 && messages[messages.length - 1].sender_id !== user?.id) markRead(lastSeq)
  }, [lastSeq, messages, user?.id, markRead])

  const older = async () => {
    const first = messages[0]?.seq
    if (!first) return
    const p = await api<Page>(`${base}/messages`, { params: { before_seq: first, limit: 30 } })
    merge(p.messages)
    setHasMore(p.has_more)
  }

  const send = async (e: FormEvent) => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    setError('')
    const clientId = crypto.randomUUID()
    const sent = chat.send({ type: 'send', conversation_id: conv.id, text: body, client_id: clientId })
    if (sent) {
      setPending((p) => [...p, { id: clientId, client_id: clientId, conversation_id: conv.id, seq: Number.MAX_SAFE_INTEGER, sender_id: user?.id ?? '', text: body, created_at: new Date().toISOString() }])
    } else {
      try { merge([await api<Message>(`${base}/messages`, { method: 'POST', body: { text: body } })]) }
      catch (err) { setError(err instanceof Error ? err.message : 'Send failed'); setText(body) }
    }
  }

  const onType = (v: string) => {
    setText(v)
    if (Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now()
      chat.send({ type: 'typing', conversation_id: conv.id })
    }
  }

  if (loading) return <Loading />
  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line p-3">
        <div><p className="font-bold">{conv.other_user.name}</p><p className="text-xs text-taupe">{conv.store_name}{conv.order_id ? ' · about an order' : ''}</p></div>
        <ReportButton targetType="conversation" targetId={conv.id} />
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3" role="log" aria-live="polite" aria-label="Messages">
        {hasMore && <div className="text-center"><Button variant="ghost" size="sm" onClick={older}>Load earlier messages</Button></div>}
        {[...messages, ...pending].map((m) => {
          const mine = m.sender_id === user?.id
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-sm', mine ? 'bg-forest text-white' : 'bg-ivory', pending.includes(m) && 'opacity-60')}>
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <p className={cn('mt-1 text-[11px]', mine ? 'text-white/70' : 'text-taupe')}>{pending.includes(m) ? 'Sending…' : formatTime(m.created_at)}{mine && !pending.includes(m) && m.seq <= otherRead ? ' · Seen' : ''}</p>
              </div>
            </div>
          )
        })}
        {typing && <p className="text-xs text-taupe">{conv.other_user.name} is typing…</p>}
        <div ref={bottom} />
      </div>
      {error && <p role="alert" className="px-3 text-sm text-bad">{error}</p>}
      <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
        <label className="sr-only" htmlFor="msg">Message</label>
        <Input id="msg" value={text} maxLength={2000} onChange={(e) => onType(e.target.value)} placeholder="Write a message…" autoComplete="off" />
        <Button type="submit" disabled={!text.trim()}>Send</Button>
      </form>
    </div>
  )
}

export default function Inbox() {
  const chat = useChat()
  const [sp, setSp] = useSearchParams()
  const { data, loading, error, reload } = useFetch<Conversation[]>('/api/chat/conversations')
  const active = data?.find((c) => c.id === sp.get('c'))
  useEffect(() => chat.subscribe((e) => { if (e.type === 'message') void reload() }), [chat, reload])
  useEffect(() => { void reload() }, [chat.reconnects, chat.unread, reload])
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Messages</h1>
        {chat.status === 'offline' && <p role="status" className="flex items-center gap-1 text-sm text-warn"><WifiOff className="h-4 w-4" aria-hidden /> Reconnecting… messages still send.</p>}
      </div>
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? <Empty title="No conversations yet">Message a seller from a store, product or order page.</Empty> : (
        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          <ul className="space-y-2" aria-label="Conversations">
            {data.map((c) => (
              <li key={c.id}>
                <button onClick={() => setSp({ c: c.id })} aria-current={c.id === active?.id} className={cn('w-full rounded-xl border border-line bg-card p-3 text-left hover:bg-ivory', c.id === active?.id && 'border-terracotta')}>
                  <div className="flex items-center justify-between"><span className="font-semibold">{c.other_user.name}</span>{c.unread > 0 && <span className="rounded-full bg-terracotta px-2 text-xs text-white" aria-label={`${c.unread} unread`}>{c.unread}</span>}</div>
                  <p className="text-xs text-taupe">{c.store_name}</p>
                  <p className="truncate text-sm text-taupe">{c.last_message?.text ?? 'No messages yet'}</p>
                </button>
              </li>
            ))}
          </ul>
          {active ? <Thread key={active.id} conv={active} /> : <Empty title="Select a conversation" />}
        </div>
      )}
    </div>
  )
}
