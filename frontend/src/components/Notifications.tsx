import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useChat } from '@/lib/chat'
import { formatTime } from '@/lib/utils'
import type { AppNotification } from '@/lib/types'

interface Inbox { unread: number; items: AppNotification[] }

export function Notifications() {
  const { subscribe } = useChat()
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<Inbox>({ unread: 0, items: [] })
  const root = useRef<HTMLDivElement>(null)

  const load = () => {
    api<Inbox>('/api/me/notifications').then(setBox).catch(() => undefined)
  }

  useEffect(() => { load() }, [])
  useEffect(() => subscribe((e) => {
    if (e.type !== 'notification') return
    setBox((cur) => cur.items.some((n) => n.id === e.notification.id) ? cur : {
      unread: cur.unread + 1,
      items: [e.notification, ...cur.items].slice(0, 30),
    })
  }), [subscribe])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const read = async (ids?: string[]) => {
    await api('/api/me/notifications/read', { method: 'POST', body: ids ? { ids } : { mark_all: true } })
    setBox((cur) => ({
      unread: ids ? Math.max(0, cur.unread - ids.length) : 0,
      items: cur.items.map((n) => !ids || ids.includes(n.id) ? { ...n, read: true } : n),
    }))
  }

  return (
    <div className="relative" ref={root}>
      <button type="button" className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors duration-200 hover:bg-white/10" aria-expanded={open} aria-haspopup="dialog" aria-label={`Notifications, ${box.unread} unread`} onClick={() => { setOpen((v) => !v); if (!open) load() }}>
        <Bell className="h-5 w-5" aria-hidden />
        {box.unread > 0 && <span className="absolute top-1 right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta px-1 text-[11px] font-bold text-on-primary">{box.unread}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 z-30 mt-1 w-[min(20rem,calc(100vw-2rem))] animate-rise rounded-2xl border border-line bg-card p-3 text-ink shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-semibold">Notifications</p>
            {box.unread > 0 && <button type="button" className="text-xs font-medium text-terracotta underline-offset-2 hover:underline" onClick={() => void read()}>Mark all read</button>}
          </div>
          {box.items.length === 0 ? <p className="py-4 text-sm text-taupe">Nothing yet. Orders, messages, and desk updates land here.</p> : (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {box.items.map((n) => (
                <li key={n.id}>
                  <Link to={n.href} className={`block rounded-xl px-2 py-2 transition-colors duration-200 hover:bg-mist ${n.read ? '' : 'bg-ivory'}`} onClick={() => { setOpen(false); if (!n.read) void read([n.id]) }}>
                    <p className="text-sm font-semibold">{n.title}{!n.read && <span className="ml-2 text-xs font-medium text-terracotta">New</span>}</p>
                    <p className="text-sm text-taupe">{n.body}</p>
                    <p className="text-[11px] text-taupe">{formatTime(n.created_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
