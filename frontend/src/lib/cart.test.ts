import { addLine, estimateTotal, groupByStore, lineKey, MAX_QTY, setQuantity, type CartLine } from './cart'

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
  it('estimates totals and groups per store', () => {
    const c = [line({ quantity: 2 }), line({ productId: 'p2', storeId: 's2', unitPriceMinor: 500 })]
    expect(estimateTotal(c)).toBe(3500)
    expect([...groupByStore(c).keys()]).toEqual(['s1', 's2'])
  })
})
