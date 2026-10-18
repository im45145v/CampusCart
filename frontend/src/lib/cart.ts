export interface CartAddon { id: string; name: string; priceMinor: number; quantity: number }
export interface CartPrintJob {
  fileUrl: string; pages: number; color: 'bw' | 'color'
  paperId: string; paperLabel: string; sides: 'single' | 'duplex'
  bindingId: string; bindingLabel: string; copies: number; urgent: boolean; note: string
  totalMinor: number; impressionMinor: number; paperMinor: number; bindingMinor: number
  urgentMinor: number; sheets: number
}
export interface CartLine {
  storeId: string; storeName: string; productId: string; variantId: string | null
  title: string; variantName: string | null; unitPriceMinor: number; quantity: number
  addons?: CartAddon[]
  printJob?: CartPrintJob | null
}

const KEY = 'campuscart.cart'
export const MAX_QTY = 99

export const lineKey = (l: Pick<CartLine, 'productId' | 'variantId' | 'addons' | 'printJob'>) => {
  const extras = (l.addons ?? []).map((a) => `${a.id}x${a.quantity}`).sort().join(',')
  return `${l.productId}:${l.variantId ?? ''}:${extras}:${l.printJob?.fileUrl ?? ''}`
}

export function addLine(cart: CartLine[], line: CartLine): CartLine[] {
  const existing = cart.find((l) => lineKey(l) === lineKey(line))
  if (line.printJob) {
    const next = { ...line, quantity: 1 }
    return existing ? cart.map((l) => (l === existing ? next : l)) : [...cart, next]
  }
  if (!existing) return [...cart, { ...line, quantity: Math.min(line.quantity, MAX_QTY) }]
  return cart.map((l) => (l === existing ? { ...l, quantity: Math.min(l.quantity + line.quantity, MAX_QTY) } : l))
}

export function setQuantity(cart: CartLine[], key: string, quantity: number): CartLine[] {
  if (quantity <= 0) return cart.filter((l) => lineKey(l) !== key)
  return cart.map((l) => (lineKey(l) === key ? { ...l, quantity: Math.min(quantity, MAX_QTY) } : l))
}

/** Display-only estimate. The server recalculates every price at checkout. */
export function lineEstimate(l: CartLine): number {
  if (l.printJob) return l.printJob.totalMinor
  const extra = (l.addons ?? []).reduce((sum, a) => sum + a.priceMinor * a.quantity, 0)
  return (l.unitPriceMinor + extra) * l.quantity
}

export function estimateTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineEstimate(l), 0)
}

export function groupByStore(cart: CartLine[]): Map<string, CartLine[]> {
  const groups = new Map<string, CartLine[]>()
  for (const l of cart) groups.set(l.storeId, [...(groups.get(l.storeId) ?? []), l])
  return groups
}

export function loadCart(): CartLine[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveCart(cart: CartLine[]): void {
  localStorage.setItem(KEY, JSON.stringify(cart))
}
