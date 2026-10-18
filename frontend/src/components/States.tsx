import { AlertCircle, Inbox, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './ui/button'

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-taupe">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {label}
    </div>
  )
}

export function SkeletonCards({ count = 4, columns = 'sm:grid-cols-2 lg:grid-cols-4' }: { count?: number; columns?: string }) {
  return (
    <div className={`grid gap-4 ${columns}`} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-line bg-card">
          <div className="aspect-[4/3] animate-pulse bg-mist" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded-md bg-mist" />
            <div className="h-3 w-1/3 animate-pulse rounded-md bg-mist" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-2" role="status" aria-label="Loading">
      <div className="h-72 animate-pulse rounded-2xl bg-mist" />
      <div className="space-y-3 py-2">
        <div className="h-8 w-2/3 animate-pulse rounded-md bg-mist" />
        <div className="h-6 w-1/3 animate-pulse rounded-md bg-mist" />
        <div className="h-24 animate-pulse rounded-md bg-mist" />
      </div>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center">
      <AlertCircle className="h-6 w-6 text-bad" aria-hidden />
      <p className="max-w-md text-bad">{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-card px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mist text-terracotta">
        <Inbox className="h-6 w-6" aria-hidden />
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="max-w-sm text-sm text-taupe">{children}</div>}
    </div>
  )
}

export function Notice({ tone, children }: { tone: 'ok' | 'bad'; children: ReactNode }) {
  return (
    <p role={tone === 'bad' ? 'alert' : 'status'} className={`rounded-xl border px-3 py-2 text-sm ${tone === 'ok' ? 'border-green-200 bg-green-50 text-ok' : 'border-red-200 bg-red-50 text-bad'}`}>
      {children}
    </p>
  )
}
