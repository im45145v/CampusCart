import { ChatClient, type SocketLike } from './chatClient'

class FakeSocket implements SocketLike {
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  readyState = 0
  sent: string[] = []
  send(d: string) { this.sent.push(d) }
  close() { this.onclose?.() }
  open() { this.readyState = 1; this.onopen?.() }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('ChatClient', () => {
  it('reconnects with a fresh ticket and asks the UI to recover missed messages', async () => {
    const sockets: FakeSocket[] = []
    const urls: string[] = []
    let n = 0
    const events: string[] = []
    let reconnects = 0
    const client = new ChatClient({
      getUrl: async () => `ws://x/${++n}`,
      createSocket: (u) => { urls.push(u); const s = new FakeSocket(); sockets.push(s); return s },
      onEvent: (e) => events.push(e.type),
      onStatus: () => undefined,
      onReconnect: () => { reconnects++ },
      baseDelayMs: 1,
    })
    await client.connect()
    sockets[0].open()
    expect(reconnects).toBe(0)
    expect(client.send({ type: 'ping' })).toBe(true)
    sockets[0].onmessage?.({ data: JSON.stringify({ type: 'pong' }) })
    sockets[0].onmessage?.({ data: 'garbage' })
    expect(events).toEqual(['pong'])

    sockets[0].readyState = 3
    sockets[0].onclose?.()
    expect(client.send({ type: 'ping' })).toBe(false) // caller falls back to REST
    await new Promise((r) => setTimeout(r, 20))
    await flush()
    sockets[1].open()
    expect(urls).toEqual(['ws://x/1', 'ws://x/2'])
    expect(reconnects).toBe(1)
    client.close()
  })
})
