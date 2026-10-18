import { formatMoney } from '@/lib/utils'
import type { SellerCharts } from '@/lib/types'

const STATUS_LABEL: Record<string, string> = {
  placed: 'Placed', quote_requested: 'Needs quote', quoted: 'Quoted', accepted: 'Accepted',
  preparing: 'Preparing', ready: 'Ready', completed: 'Completed', rejected: 'Rejected', cancelled: 'Cancelled',
}

export function RevenueChart({ days }: { days: SellerCharts['days'] }) {
  const max = Math.max(1, ...days.map((d) => d.revenue_minor))
  return (
    <figure className="space-y-3">
      <figcaption className="font-semibold text-forest">Completed revenue, last 14 days</figcaption>
      <div className="flex h-40 items-end gap-1" aria-hidden>
        {days.map((d) => (
          <div key={d.date} className="flex h-full flex-1 flex-col justify-end" title={`${d.date}: ${formatMoney(d.revenue_minor)}, ${d.orders} orders`}>
            <div className="w-full rounded-t bg-terracotta" style={{ height: `${Math.max(d.revenue_minor ? 6 : 0, (d.revenue_minor / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Daily completed revenue</caption>
        <thead><tr className="text-taupe"><th className="py-1 font-medium">Day</th><th className="font-medium">Orders</th><th className="font-medium">Revenue</th></tr></thead>
        <tbody>
          {days.filter((d) => d.orders > 0).map((d) => (
            <tr key={d.date} className="border-t border-line"><td className="py-1">{d.date}</td><td>{d.orders}</td><td>{formatMoney(d.revenue_minor)}</td></tr>
          ))}
          {days.every((d) => d.orders === 0) && <tr><td colSpan={3} className="py-2 text-taupe">No completed orders in this window yet.</td></tr>}
        </tbody>
      </table>
    </figure>
  )
}

export function StatusChart({ byStatus }: { byStatus: Record<string, number> }) {
  const rows = Object.entries(byStatus).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...rows.map(([, n]) => n))
  if (!rows.length) return <p className="text-sm text-taupe">No orders yet, so there is nothing to chart.</p>
  return (
    <figure className="space-y-2">
      <figcaption className="font-semibold text-forest">Orders by status</figcaption>
      <ul className="space-y-2">
        {rows.map(([status, n]) => (
          <li key={status}>
            <div className="mb-1 flex justify-between text-sm"><span>{STATUS_LABEL[status] ?? status}</span><span>{n}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-ivory" role="img" aria-label={`${STATUS_LABEL[status] ?? status}: ${n}`}>
              <div className="h-full rounded-full bg-forest" style={{ width: `${(n / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </figure>
  )
}
