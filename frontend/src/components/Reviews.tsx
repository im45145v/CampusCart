import { useState } from 'react'
import { Notice } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Textarea } from '@/components/ui/input'
import { api } from '@/lib/api'
import { formatTime } from '@/lib/utils'
import type { Review, ReviewAspects } from '@/lib/types'

export function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-1" role={onChange ? 'radiogroup' : undefined} aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n} type="button" disabled={!onChange}
          role={onChange ? 'radio' : undefined} aria-checked={onChange ? value === n : undefined}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange?.(n)}
          className={`text-xl leading-none ${n <= value ? 'text-terracotta' : 'text-line'} ${onChange ? 'hover:text-terracotta' : ''}`}
        >★</button>
      ))}
    </div>
  )
}

function AspectLine({ label, n }: { label: string; n: number }) {
  return <span className="rounded-full bg-ivory px-2 py-0.5 text-xs text-forest">{label} {n}/5</span>
}

export function ReviewCard({ review, canReply, onReplied }: { review: Review; canReply?: boolean; onReplied?: () => void }) {
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const send = async () => {
    setError('')
    try {
      await api(`/api/reviews/${review.id}/reply`, { method: 'POST', body: { reply } })
      setReply('')
      onReplied?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reply')
    }
  }
  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Stars value={review.rating} />
        <p className="text-sm text-taupe">{review.buyer_name} · {formatTime(review.created_at)}</p>
      </div>
      {review.comment && <p>{review.comment}</p>}
      {review.aspects && (
        <div className="flex flex-wrap gap-2">
          <AspectLine label="Quality" n={review.aspects.quality} />
          <AspectLine label="Timing" n={review.aspects.timing} />
          <AspectLine label="Value" n={review.aspects.value} />
        </div>
      )}
      {review.seller_reply && (
        <p className="rounded-xl bg-ivory px-3 py-2 text-sm"><span className="font-semibold text-forest">Seller reply. </span>{review.seller_reply}</p>
      )}
      {canReply && !review.seller_reply && (
        <div className="space-y-2">
          <Field label="Reply once, as the store"><Textarea className="min-h-16" maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} /></Field>
          <Button size="sm" disabled={!reply.trim()} onClick={send}>Post reply</Button>
          {error && <Notice tone="bad">{error}</Notice>}
        </div>
      )}
    </Card>
  )
}

export function RatingBars({ hist, count }: { hist?: Record<string, number>; count: number }) {
  if (!count) return null
  return (
    <ul className="mb-4 space-y-1" aria-label="Rating breakdown">
      {[5, 4, 3, 2, 1].map((n) => {
        const hits = hist?.[String(n)] ?? 0
        return (
          <li key={n} className="flex items-center gap-2 text-sm">
            <span className="w-8 text-taupe">{n}★</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-ivory">
              <span className="block h-full bg-terracotta" style={{ width: `${(hits / count) * 100}%` }} />
            </span>
            <span className="w-6 text-right text-taupe">{hits}</span>
          </li>
        )
      })}
    </ul>
  )
}

const emptyAspects = { quality: 5, timing: 5, value: 5 }

export function ReviewForm({ orderId, onDone }: { orderId: string; onDone: (review: Review) => void }) {
  const [rating, setRating] = useState(5)
  const [aspects, setAspects] = useState<ReviewAspects>(emptyAspects)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const submit = async () => {
    setError('')
    try {
      onDone(await api<Review>(`/api/orders/${orderId}/review`, { method: 'POST', body: { rating, comment, aspects } }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the review')
    }
  }
  const setAspect = (k: keyof ReviewAspects, n: number) => setAspects({ ...aspects, [k]: n })
  return (
    <Card className="space-y-4">
      <h2 className="font-bold">Review this order</h2>
      <div className="space-y-1"><p className="text-sm font-medium text-forest">Overall</p><Stars value={rating} onChange={setRating} /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1"><p className="text-sm font-medium text-forest">Quality</p><Stars value={aspects.quality} onChange={(n) => setAspect('quality', n)} /></div>
        <div className="space-y-1"><p className="text-sm font-medium text-forest">Timing</p><Stars value={aspects.timing} onChange={(n) => setAspect('timing', n)} /></div>
        <div className="space-y-1"><p className="text-sm font-medium text-forest">Value</p><Stars value={aspects.value} onChange={(n) => setAspect('value', n)} /></div>
      </div>
      <Field label="Comment"><Textarea maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What should the next student know?" /></Field>
      <Button onClick={submit}>Submit review</Button>
      {error && <Notice tone="bad">{error}</Notice>}
    </Card>
  )
}
