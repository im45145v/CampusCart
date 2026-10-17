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

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
      <AlertCircle className="h-6 w-6 text-bad" aria-hidden />
      <p className="text-bad">{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-taupe">
      <Inbox className="h-7 w-7" aria-hidden />
      <p className="font-medium text-forest">{title}</p>
      {children}
    </div>
  )
}

export function Notice({ tone, children }: { tone: 'ok' | 'bad'; children: ReactNode }) {
  return (
    <p role={tone === 'bad' ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${tone === 'ok' ? 'border-green-200 bg-green-50 text-ok' : 'border-red-200 bg-red-50 text-bad'}`}>
      {children}
    </p>
  )
}
