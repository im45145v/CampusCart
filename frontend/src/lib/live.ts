import { useEffect } from 'react'
import { useChat } from './chat'
import type { Order } from './types'

/** Apply order snapshots pushed over the chat WebSocket. */
export function useLiveOrders(onOrder: (order: Order) => void): 'connecting' | 'online' | 'offline' {
  const { subscribe, status } = useChat()
  useEffect(() => subscribe((e) => {
    if (e.type === 'order') onOrder(e.order)
  }), [subscribe, onOrder])
  return status
}
