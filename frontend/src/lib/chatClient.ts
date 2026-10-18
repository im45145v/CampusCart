import type { AppNotification, Message, Order } from './types'

export type ServerEvent =
  | { type: 'ready'; user_id: string }
  | { type: 'ack'; client_id: string; message: Message }
  | { type: 'message'; message: Message }
  | { type: 'typing'; conversation_id: string; user_id: string }
  | { type: 'read'; conversation_id: string; reader_id: string; up_to_seq: number }
  | { type: 'error'; code: string; client_id?: string }
  | { type: 'pong' }
  | { type: 'presence'; user_id: string; online: boolean }
  | { type: 'order'; order: Order }
  | { type: 'notification'; notification: AppNotification }

export interface SocketLike {
  onopen: (() => void) | null
  onmessage: ((e: { data: string }) => void) | null
  onclose: (() => void) | null
  send(data: string): void
  close(): void
  readyState: number
}

export interface ChatClientOptions {
  getUrl: () => Promise<string>
  createSocket: (url: string) => SocketLike
  onEvent: (e: ServerEvent) => void
  onStatus: (s: 'connecting' | 'online' | 'offline') => void
  /** Called after every (re)connect so the UI can fetch messages it missed (after_seq). */
  onReconnect: () => void
  baseDelayMs?: number
}

const OPEN = 1

/** WebSocket wrapper with exponential-backoff reconnect and fresh single-use tickets. */
export class ChatClient {
  private socket: SocketLike | null = null
  private attempts = 0
  private closed = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private o: ChatClientOptions
  constructor(options: ChatClientOptions) {
    this.o = options
  }

  async connect(): Promise<void> {
    if (this.closed) return
    this.o.onStatus('connecting')
    try {
      const url = await this.o.getUrl()
      const s = this.o.createSocket(url)
      this.socket = s
      s.onopen = () => {
        const wasReconnect = this.attempts > 0
        this.attempts = 0
        this.o.onStatus('online')
        if (wasReconnect) this.o.onReconnect()
      }
      s.onmessage = (e) => {
        try {
          this.o.onEvent(JSON.parse(e.data) as ServerEvent)
        } catch {
          /* ignore malformed frames */
        }
      }
      s.onclose = () => this.scheduleReconnect()
    } catch {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.closed) return
    this.o.onStatus('offline')
    this.attempts += 1
    const delay = Math.min((this.o.baseDelayMs ?? 1000) * 2 ** (this.attempts - 1), 30000)
    this.timer = setTimeout(() => void this.connect(), delay)
  }

  /** Returns false when offline so the caller can fall back to the REST endpoint. */
  send(frame: Record<string, unknown>): boolean {
    if (!this.socket || this.socket.readyState !== OPEN) return false
    this.socket.send(JSON.stringify(frame))
    return true
  }

  close() {
    this.closed = true
    if (this.timer) clearTimeout(this.timer)
    this.socket?.close()
  }
}
