import { cn } from '@/lib/utils'

export function tabClass(selected: boolean) {
  return cn(
    'inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors duration-200',
    selected ? 'bg-terracotta text-on-primary' : 'text-ink hover:bg-mist',
  )
}
