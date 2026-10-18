import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-line bg-card p-4 shadow-[0_1px_2px_rgba(23,37,84,0.05)]', className)} {...props} />
}
