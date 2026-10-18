import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'ok' | 'bad'
interface ToastItem { id: number; tone: Tone; text: string }

const ToastContext = createContext<(tone: Tone, text: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const timers = useRef<number[]>([])

  const dismiss = useCallback((id: number) => {
    setItems((cur) => cur.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((tone: Tone, text: string) => {
    const id = ++seq.current
    setItems((cur) => [...cur, { id, tone, text }].slice(-3))
    const timer = window.setTimeout(() => dismiss(id), 4200)
    timers.current.push(timer)
  }, [dismiss])

  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)) }, [])

  const value = useMemo(() => push, [push])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'bad' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex w-full max-w-md animate-toast items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-lg',
              t.tone === 'ok' ? 'border-green-200 text-ok' : 'border-red-200 text-bad',
            )}
          >
            <p className="flex-1 pt-0.5">{t.text}</p>
            <button type="button" aria-label="Dismiss notification" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-mist" onClick={() => dismiss(t.id)}>
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
