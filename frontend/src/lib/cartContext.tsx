import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { addLine, loadCart, saveCart, setQuantity, type CartLine } from './cart'

interface CartState {
  lines: CartLine[]
  count: number
  add: (l: CartLine) => void
  setQty: (key: string, q: number) => void
  removeStore: (storeId: string) => void
}
const CartContext = createContext<CartState | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(loadCart)
  useEffect(() => saveCart(lines), [lines])
  const value = useMemo<CartState>(
    () => ({
      lines,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      add: (l) => setLines((c) => addLine(c, l)),
      setQty: (k, q) => setLines((c) => setQuantity(c, k, q)),
      removeStore: (id) => setLines((c) => c.filter((l) => l.storeId !== id)),
    }),
    [lines],
  )
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartState {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
