import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, wsUrl } from './api'
import { useAuth } from './auth'
import { ChatClient, type ServerEvent, type SocketLike } from './chatClient'

type Listener = (e: ServerEvent) => void
interface ChatState {
  status: 'connecting' | 'online' | 'offline'
  unread: number
  reconnects: number
  send: (frame: Record<string, unknown>) => boolean
  subscribe: (l: Listener) => () => void
  refreshUnread: () => void
}

const ChatContext = createContext<ChatState | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [status, setStatus] = useState<ChatState['status']>('offline')
  const [unread, setUnread] = useState(0)
  const [reconnects, setReconnects] = useState(0)
  const listeners = useRef(new Set<Listener>())
  const client = useRef<ChatClient | null>(null)

  const refreshUnread = useCallback(() => {
    api<{ unread: number }>('/api/chat/unread').then((r) => setUnread(r.unread)).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!user) return
    refreshUnread()
    const c = new ChatClient({
      getUrl: async () => wsUrl((await api<{ ticket: string }>('/api/chat/ws-ticket', { method: 'POST' })).ticket),
      createSocket: (url) => new WebSocket(url) as unknown as SocketLike,
      onStatus: setStatus,
      onReconnect: () => {
        setReconnects((n) => n + 1)
        refreshUnread()
      },
      onEvent: (e) => {
        if (e.type === 'message' || e.type === 'read') refreshUnread()
        listeners.current.forEach((l) => l(e))
      },
    })
    client.current = c
    void c.connect()
    return () => {
      c.close()
      client.current = null
      setStatus('offline')
    }
  }, [user, refreshUnread])

  const subscribe = useCallback((l: Listener) => {
    listeners.current.add(l)
    return () => listeners.current.delete(l)
  }, [])

  const value = useMemo<ChatState>(
    () => ({
      status,
      unread: user ? unread : 0,
      reconnects,
      send: (f) => client.current?.send(f) ?? false,
      subscribe,
      refreshUnread,
    }),
    [status, unread, reconnects, user, refreshUnread, subscribe],
  )
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat(): ChatState {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used inside ChatProvider')
  return ctx
}
