import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
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

  const read = async (ids?: string[]) => {
    await api('/api/me/notifications/read', { method: 'POST', body: ids ? { ids } : { mark_all: true } })
    setBox((cur) => ({
      unread: ids ? Math.max(0, cur.unread - ids.length) : 0,
      items: cur.items.map((n) => !ids || ids.includes(n.id) ? { ...n, read: true } : n),
    }))
  }

  return (
    <div className="relative">
      <button type="button" className="rounded-md px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10" aria-expanded={open} aria-label={`Notifications, ${box.unread} unread`} onClick={() => { setOpen((v) => !v); if (!open) load() }}>
        <Bell className="inline h-4 w-4" aria-hidden />
        {box.unread > 0 && <span className="ml-1 rounded-full bg-terracotta px-1.5 text-xs text-white">{box.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-80 rounded-xl border border-line bg-card p-3 text-ink shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-bold text-forest">Notifications</p>
            {box.unread > 0 && <button type="button" className="text-xs text-terracotta underline" onClick={() => void read()}>Mark all read</button>}
          </div>
          {box.items.length === 0 ? <p className="text-sm text-taupe">Nothing yet. Orders, messages, and desk updates land here.</p> : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {box.items.map((n) => (
                <li key={n.id}>
                  <Link to={n.href} className="block rounded-lg px-2 py-1.5 hover:bg-ivory" onClick={() => { setOpen(false); if (!n.read) void read([n.id]) }}>
                    <p className="text-sm font-semibold">{n.title}{!n.read && <span className="ml-2 text-xs text-terracotta">New</span>}</p>
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
