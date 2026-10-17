import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const tones = {
  neutral: 'bg-ivory text-taupe border-line',
  ok: 'bg-green-50 text-ok border-green-200',
  warn: 'bg-amber-50 text-warn border-amber-200',
  bad: 'bg-red-50 text-bad border-red-200',
}

export function Badge({ tone = 'neutral', className, ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', tones[tone], className)} {...p} />
}

export function statusTone(status: string): keyof typeof tones {
  if (['completed', 'ready', 'accepted', 'active', 'resolved'].includes(status)) return 'ok'
  if (['rejected', 'cancelled', 'suspended', 'removed'].includes(status)) return 'bad'
  if (['placed', 'quote_requested', 'quoted', 'preparing', 'open'].includes(status)) return 'warn'
  return 'neutral'
}
