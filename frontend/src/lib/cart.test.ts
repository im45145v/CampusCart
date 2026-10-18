import { addLine, borrowUnits, estimateTotal, groupByStore, lineKey, MAX_QTY, setQuantity, type CartLine } from './cart'

const line = (over: Partial<CartLine> = {}): CartLine => ({
  storeId: 's1', storeName: 'S', productId: 'p1', variantId: null, title: 'Samosa',
  variantName: null, unitPriceMinor: 1500, quantity: 1, ...over,
})

describe('cart', () => {
  it('merges identical lines and caps quantity', () => {
    let c = addLine([], line())
    c = addLine(c, line({ quantity: 2 }))
    expect(c).toHaveLength(1)
    expect(c[0].quantity).toBe(3)
    expect(addLine(c, line({ quantity: 500 }))[0].quantity).toBe(MAX_QTY)
  })
  it('keeps variants separate', () => {
    const c = addLine(addLine([], line({ variantId: 'a' })), line({ variantId: 'b' }))
    expect(c).toHaveLength(2)
  })
  it('removes a line at quantity 0 and updates quantities', () => {
    const c = addLine([], line())
    expect(setQuantity(c, lineKey(c[0]), 4)[0].quantity).toBe(4)
    expect(setQuantity(c, lineKey(c[0]), 0)).toEqual([])
  })
  it('bills whole days and stops at the listing cap', () => {
    expect(borrowUnits({ unit: 'day', collectOn: '2026-10-19', returnOn: '2026-10-21', maxUnits: 3 })).toEqual({ units: 2, error: '' })
    expect(borrowUnits({ unit: 'day', collectOn: '2026-10-19', returnOn: '2026-10-19', maxUnits: 3 }).units).toBe(1)
    expect(borrowUnits({ unit: 'day', collectOn: '2026-10-19', returnOn: '2026-10-23', maxUnits: 2 }).error).toBe('At most 2 days')
  })
  it('bills hours from the handover to the return time', () => {
    const span = borrowUnits({ unit: 'hour', collectOn: '2026-10-19', returnOn: '2026-10-19', slotLabel: '12:00-14:00', returnTime: '18:00', maxUnits: 8 })
    expect(span).toEqual({ units: 6, error: '' })
    expect(borrowUnits({ unit: 'hour', collectOn: '2026-10-19', returnOn: '2026-10-19', slotLabel: '12:00-14:00', returnTime: '20:00', maxUnits: 6 }).error).toBe('At most 6 hours')
  })
  it('estimates totals and groups per store', () => {
    const c = [line({ quantity: 2 }), line({ productId: 'p2', storeId: 's2', unitPriceMinor: 500 })]
    expect(estimateTotal(c)).toBe(3500)
    expect([...groupByStore(c).keys()]).toEqual(['s1', 's2'])
  })
  it('keeps different extras apart and adds their price', () => {
    const egg = { id: 'egg', name: 'Fried egg', priceMinor: 2000, quantity: 1 }
    const c = addLine(addLine([], line({ addons: [egg] })), line())
    expect(c).toHaveLength(2)
    expect(estimateTotal([line({ quantity: 2, addons: [egg] })])).toBe(7000)
  })
})
