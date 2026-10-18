import { useEffect, useState } from 'react'
import { Notice } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { api } from '@/lib/api'
import type { CartPrintJob } from '@/lib/cart'
import { formatMoney } from '@/lib/utils'
import type { PrintSpec, Product } from '@/lib/types'

interface Upload { url: string; pages: number; media: string }
interface Priced {
  pages: number; copies: number; color: 'bw' | 'color'; paper: string; paper_id: string
  sides: 'single' | 'duplex'; binding: string; binding_id: string; urgent: boolean; note: string
  impressions: number; sheets: number; impression_minor: number; paper_minor: number
  binding_minor: number; urgent_minor: number; total_minor: number; file_url: string
}

function printSummary(job: { pages: number; copies: number; color: string; paper: string; sides: string; binding: string; urgent: boolean; impressions: number; sheets: number; impression_minor: number; paper_minor: number; binding_minor: number; urgent_minor: number; total_minor: number }) {
  const rate = job.impressions ? job.impression_minor / job.impressions : 0
  return [
    `${job.pages} pages × ${job.copies} ${job.copies === 1 ? 'copy' : 'copies'} × ${formatMoney(rate)} ${job.color === 'color' ? 'colour' : 'black and white'} = ${formatMoney(job.impression_minor)}`,
    `${job.sheets} sheets of ${job.paper}, ${job.sides === 'duplex' ? 'double sided' : 'single sided'} = ${formatMoney(job.paper_minor)}`,
    `${job.binding} = ${formatMoney(job.binding_minor)}`,
    job.urgent ? `Urgent = ${formatMoney(job.urgent_minor)}` : '',
  ].filter(Boolean)
}

export function PrintDesk({ product, onAdd, disabled = false }: { product: Product; onAdd: (job: CartPrintJob) => void; disabled?: boolean }) {
  const spec = product.print_spec as PrintSpec
  const [file, setFile] = useState<Upload | null>(null)
  const [color, setColor] = useState<'bw' | 'color'>('bw')
  const [paperId, setPaperId] = useState(spec.papers[0]?.id ?? '')
  const [sides, setSides] = useState<'single' | 'duplex'>('single')
  const [bindingId, setBindingId] = useState(spec.bindings[0]?.id ?? '')
  const [copies, setCopies] = useState(1)
  const [urgent, setUrgent] = useState(false)
  const [note, setNote] = useState('')
  const [priced, setPriced] = useState<Priced | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const upload = async (list: FileList | null) => {
    const chosen = list?.[0]
    if (!chosen) return
    setBusy(true)
    setError('')
    setPriced(null)
    try {
      const form = new FormData()
      form.append('file', chosen)
      setFile(await api<Upload>('/api/uploads/documents', { method: 'POST', form }))
    } catch (e) {
      setFile(null)
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!file) return
    const handle = window.setTimeout(() => {
      void api<Priced>(`/api/products/${product.id}/print-preview`, {
        method: 'POST',
        body: {
          file_url: file.url, color, paper_id: paperId, sides, binding_id: bindingId,
          copies, urgent, note,
        },
      }).then(setPriced).catch((e: Error) => { setPriced(null); setError(e.message) })
    }, 200)
    return () => window.clearTimeout(handle)
  }, [file, color, paperId, sides, bindingId, copies, urgent, note, product.id])

  const add = () => {
    if (!priced || !file) return
    onAdd({
      fileUrl: file.url, pages: priced.pages, color: priced.color,
      paperId: priced.paper_id, paperLabel: priced.paper, sides: priced.sides,
      bindingId: priced.binding_id, bindingLabel: priced.binding, copies: priced.copies,
      urgent: priced.urgent, note: priced.note, totalMinor: priced.total_minor,
      impressionMinor: priced.impression_minor, paperMinor: priced.paper_minor,
      bindingMinor: priced.binding_minor, urgentMinor: priced.urgent_minor, sheets: priced.sheets,
    })
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-3">
      <p className="text-sm text-taupe">Upload the file first. We count the pages, then the price follows the rate card. The seller receives the file and this breakdown.</p>
      <Field label="File" hint="PDF, PNG, JPEG, or WebP. Up to 2 MB. Password-protected PDFs are refused.">
        <Input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => void upload(e.target.files)} />
      </Field>
      {file && <p className="text-sm font-medium text-forest">{file.media === 'pdf' ? `${file.pages} pages read from the PDF` : '1 page (image)'}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ink"><Select value={color} onChange={(e) => setColor(e.target.value as 'bw' | 'color')}><option value="bw">Black and white, {formatMoney(spec.bw_per_page_minor)} / page</option><option value="color">Colour, {formatMoney(spec.color_per_page_minor)} / page</option></Select></Field>
        <Field label="Paper"><Select value={paperId} onChange={(e) => setPaperId(e.target.value)}>{spec.papers.map((p) => <option key={p.id} value={p.id}>{p.label}{p.extra_per_sheet_minor ? `, +${formatMoney(p.extra_per_sheet_minor)} / sheet` : ''}</option>)}</Select></Field>
        <Field label="Sides"><Select value={sides} onChange={(e) => setSides(e.target.value as 'single' | 'duplex')}><option value="single">Single sided</option>{spec.allow_duplex && <option value="duplex">Double sided</option>}</Select></Field>
        <Field label="Binding"><Select value={bindingId} onChange={(e) => setBindingId(e.target.value)}>{spec.bindings.map((b) => <option key={b.id} value={b.id}>{b.label}{b.price_minor ? `, ${formatMoney(b.price_minor)} / copy` : ''}</option>)}</Select></Field>
        <Field label="Copies"><Input type="number" min={1} max={spec.max_copies} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(spec.max_copies, Number(e.target.value) || 1)))} /></Field>
        {spec.urgent_percent > 0 && <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Urgent, +{spec.urgent_percent}%</label>}
      </div>
      <Field label="Note for the print desk"><Textarea className="min-h-16" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      {priced && (
        <div className="space-y-1 text-sm">
          {printSummary(priced).map((line) => <p key={line}>{line}</p>)}
          <p className="font-bold text-terracotta">Total {formatMoney(priced.total_minor)}</p>
        </div>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
      <Button type="button" disabled={!priced || busy || disabled} onClick={add}>{busy ? 'Reading file…' : 'Add print job to cart'}</Button>
    </div>
  )
}
