import { Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { StoreBanner } from '@/components/StoreBanner'
import { api } from '@/lib/api'
import { contrast, DEFAULT_THEME, THEME_PRESETS, themeStyle } from '@/lib/theme'
import type { CustomField, OrderSettings, Store, StoreTheme } from '@/lib/types'

export function ImageUpload({ label, value, onChange, previewClass = 'h-24 w-40' }: {
  label: string; value: string | null; onChange: (url: string | null) => void; previewClass?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async (file?: File | null) => {
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    setBusy(true)
    setError('')
    try {
      onChange((await api<{ url: string }>('/api/uploads', { method: 'POST', form })).url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-forest">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={`flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-line bg-ivory text-center text-xs text-taupe ${previewClass}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void send(e.dataTransfer.files?.[0]) }}
        >
          {value
            ? <img src={value} alt="" className="h-full w-full object-cover" onError={() => setError('The photo could not be shown. Choose it again.')} />
            : busy ? 'Uploading…' : 'Click or drop a photo'}
          <input ref={input} type="file" aria-label={label} accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={(e) => void send(e.target.files?.[0])} />
        </label>
        <div className="space-y-1">
          <p className="text-xs text-taupe">PNG, JPEG or WebP, up to 2 MB.</p>
          {value && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>Remove image</Button>}
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  )
}

export function ThemeEditor({ value, onChange, store }: { value: StoreTheme; onChange: (t: StoreTheme) => void; store: Pick<Store, 'name' | 'logo_url' | 'banner_url' | 'tagline'> }) {
  const set = <K extends keyof StoreTheme>(k: K, v: StoreTheme[K]) => onChange({ ...value, [k]: v })
  const lowContrast = contrast(value.primary, '#ffffff') < 3
  const lowBg = contrast(value.accent, value.background) < 3
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Theme presets">
        {THEME_PRESETS.map((p) => (
          <button key={p.name} type="button" onClick={() => onChange(p.theme)} className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 text-sm hover:bg-ivory">
            {[p.theme.primary, p.theme.accent, p.theme.background].map((c) => <span key={c} className="h-4 w-4 rounded-full border border-line" style={{ background: c }} />)}
            {p.name}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {([['primary', 'Buttons and highlights'], ['accent', 'Headings and navigation'], ['background', 'Page background']] as const).map(([k, label]) => (
          <Field key={k} label={label}>
            <span className="flex items-center gap-2">
              <input type="color" aria-label={label} value={value[k]} onChange={(e) => set(k, e.target.value.toUpperCase())} className="h-10 w-12 cursor-pointer rounded border border-line bg-white p-1" />
              <span className="font-mono text-xs">{value[k]}</span>
            </span>
          </Field>
        ))}
        <Field label="Heading font"><Select value={value.font} onChange={(e) => set('font', e.target.value as StoreTheme['font'])}><option value="modern">Modern</option><option value="serif">Classic serif</option><option value="rounded">Friendly rounded</option></Select></Field>
        <Field label="Corners"><Select value={value.radius} onChange={(e) => set('radius', e.target.value as StoreTheme['radius'])}><option value="sharp">Sharp</option><option value="soft">Soft</option><option value="pill">Extra round</option></Select></Field>
        <div className="flex items-end"><Button type="button" variant="ghost" size="sm" onClick={() => onChange(DEFAULT_THEME)}>Reset to default</Button></div>
      </div>
      {lowContrast && <p className="text-sm text-warn">Button text is white; this highlight colour is too light to read comfortably. Pick a darker one.</p>}
      {lowBg && <p className="text-sm text-warn">Headings are hard to read on this background. Pick colours that contrast more.</p>}
      <div className="rounded-2xl p-4" style={{ ...themeStyle(value), background: value.background }} aria-label="Theme preview">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-taupe">Live preview</p>
        <StoreBanner store={{ ...store, name: store.name || 'Your store', theme: value }} height="h-24">
          <Button type="button" tabIndex={-1}>Add to cart</Button>
        </StoreBanner>
      </div>
    </div>
  )
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'question'
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}{hint && <span className="block text-xs text-taupe">{hint}</span>}</span>
    </label>
  )
}

function SlotBuilder({ slots, onChange }: { slots: string[]; onChange: (s: string[]) => void }) {
  const [from, setFrom] = useState('12:00')
  const [to, setTo] = useState('14:00')
  const [every, setEvery] = useState(30)
  const generate = () => {
    const out: string[] = []
    for (let m = toMin(from); m + every <= toMin(to) && out.length < 24; m += every) out.push(`${fromMin(m)}-${fromMin(m + every)}`)
    onChange([...new Set([...slots, ...out])].sort())
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="From"><Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="w-32" /></Field>
        <Field label="Until"><Input type="time" value={to} onChange={(e) => setTo(e.target.value)} className="w-32" /></Field>
        <Field label="Slot length"><Select value={every} onChange={(e) => setEvery(Number(e.target.value))} className="w-28">{[10, 15, 20, 30, 45, 60, 90, 120].map((n) => <option key={n} value={n}>{n} min</option>)}</Select></Field>
        <Button type="button" variant="secondary" onClick={generate}><Plus className="h-4 w-4" aria-hidden /> Add slots</Button>
      </div>
      {slots.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Pickup slots">
          {slots.map((s) => (
            <li key={s} className="flex items-center gap-1 rounded-full border border-line bg-white py-1 pl-3 pr-1 text-sm">
              {s}
              <button type="button" aria-label={`Remove slot ${s}`} className="rounded-full p-1 hover:bg-ivory" onClick={() => onChange(slots.filter((x) => x !== s))}><X className="h-3 w-3" aria-hidden /></button>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-taupe">No slots yet.</p>}
    </div>
  )
}

const QUESTION_PACKS: { name: string; blurb: string; fields: CustomField[] }[] = [
  {
    name: 'Food stall', blurb: 'Hostel, spice, cutlery',
    fields: [
      { id: 'hostel', label: 'Hostel or block', type: 'select', required: true, options: ['A', 'B', 'C', 'D', 'Day scholar'] },
      { id: 'spice', label: 'Spice level', type: 'select', required: false, options: ['Mild', 'Medium', 'Hot'] },
      { id: 'cutlery', label: 'Include cutlery', type: 'checkbox', required: false, options: [] },
    ],
  },
  {
    name: 'Print shop', blurb: 'Paper, colour, sides',
    fields: [
      { id: 'paper', label: 'Paper size', type: 'select', required: true, options: ['A4', 'A3', 'Letter'] },
      { id: 'colour', label: 'Colour or black and white', type: 'select', required: true, options: ['Black and white', 'Colour'] },
      { id: 'sides', label: 'Sides', type: 'select', required: false, options: ['Single', 'Double'] },
    ],
  },
  {
    name: 'Lending desk', blurb: 'Return date and campus ID',
    fields: [
      { id: 'return_by', label: 'Return by', type: 'date', required: true, options: [] },
      { id: 'student_id', label: 'Last 4 of campus ID', type: 'text', required: true, options: [] },
      { id: 'condition_ok', label: 'I will return it in the same condition', type: 'checkbox', required: true, options: [] },
    ],
  },
]

function QuestionEditor({ fields, onChange }: { fields: CustomField[]; onChange: (f: CustomField[]) => void }) {
  const patch = (i: number, p: Partial<CustomField>) => onChange(fields.map((f, j) => (j === i ? { ...f, ...p } : f)))
  const add = () => {
    let id = `question_${fields.length + 1}`
    while (fields.some((f) => f.id === id)) id += '_x'
    onChange([...fields, { id, label: '', type: 'text', required: false, options: [] }])
  }
  return (
    <div className="space-y-3">
      {fields.map((f, i) => (
        <div key={f.id} className="space-y-2 rounded-xl border border-line bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
            <Field label="Question buyers see"><Input value={f.label} maxLength={80} placeholder="e.g. Spice level" onChange={(e) => patch(i, { label: e.target.value, id: f.label ? f.id : slug(e.target.value) + '_' + (i + 1) })} /></Field>
            <Field label="Answer type"><Select value={f.type} onChange={(e) => patch(i, { type: e.target.value as CustomField['type'] })}><option value="text">Short text</option><option value="date">Date</option><option value="select">Choose one</option><option value="checkbox">Yes / no</option></Select></Field>
          </div>
          {f.type === 'select' && <Field label="Choices (comma separated, at least two)"><Input value={f.options.join(', ')} onChange={(e) => patch(i, { options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })} placeholder="mild, medium, hot" /></Field>}
          <div className="flex items-center justify-between">
            <Toggle label="Required" checked={f.required} onChange={(v) => patch(i, { required: v })} />
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(fields.filter((_, j) => j !== i))}>Remove question</Button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {fields.length < 8 && <Button type="button" variant="secondary" onClick={add}><Plus className="h-4 w-4" aria-hidden /> Add a question</Button>}
        {QUESTION_PACKS.map((pack) => (
          <Button key={pack.name} type="button" variant="ghost" size="sm" onClick={() => {
            const next = [...fields]
            for (const field of pack.fields) {
              if (next.length >= 8 || next.some((f) => f.id === field.id)) continue
              next.push(field)
            }
            onChange(next)
          }}>{pack.name}</Button>
        ))}
      </div>
    </div>
  )
}

export function OrderSettingsEditor({ value, onChange }: { value: OrderSettings; onChange: (s: OrderSettings) => void }) {
  const set = <K extends keyof OrderSettings>(k: K, v: OrderSettings[K]) => onChange({ ...value, [k]: v })
  const num = (v: string, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)))
  const pick = <T extends string>(list: T[], item: T, on: boolean): T[] => {
    const next = on ? [...new Set([...list, item])] : list.filter((x) => x !== item)
    return next.length ? next : list // always keep one option
  }
  return (
    <div className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="font-semibold text-forest">How buyers receive orders</legend>
        <Toggle label="Pickup at the store" checked={value.fulfillment_options.includes('pickup')} onChange={(v) => set('fulfillment_options', pick(value.fulfillment_options, 'pickup', v))} />
        <Toggle label="Campus meetup" checked={value.fulfillment_options.includes('campus_meetup')} onChange={(v) => set('fulfillment_options', pick(value.fulfillment_options, 'campus_meetup', v))} />
        <Toggle label="Pay on pickup" hint="Cash when they collect. Turn this off if you will not start until campus credits are taken." checked={value.payment_options.includes('pay_on_pickup')} onChange={(v) => set('payment_options', pick(value.payment_options, 'pay_on_pickup', v))} />
        <Toggle label="Pay seller directly (you confirm receipt)" hint="You mark that you received it. CampusCart does not check a bank or UPI." checked={value.payment_options.includes('manual_confirmation')} onChange={(v) => set('payment_options', pick(value.payment_options, 'manual_confirmation', v))} />
        <Toggle label="Campus wallet" hint="Campus credits, taken when the price is known. If this is the only method, the stall is listed as pay upfront. A cancel or rejection returns the credits. This is not a bank payment." checked={value.payment_options.includes('campus_wallet')} onChange={(v) => set('payment_options', pick(value.payment_options, 'campus_wallet', v))} />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold text-forest">Quantity and minimum</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Most of one item per order"><Input type="number" min={1} max={99} value={value.max_qty_per_item} onChange={(e) => set('max_qty_per_item', Math.max(1, num(e.target.value, 99)))} /></Field>
          <Field label="Minimum order (₹)" hint="0 means no minimum. Quote-based printing orders are exempt."><Input type="number" min={0} step="1" value={value.min_order_minor / 100} onChange={(e) => set('min_order_minor', Math.round(num(e.target.value, 100000) * 100))} /></Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold text-forest">Wait time</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Base wait (minutes)" hint="Added to every order, on top of the slowest item's prep time."><Input type="number" min={0} max={1440} value={value.lead_time_min} onChange={(e) => set('lead_time_min', num(e.target.value, 1440))} /></Field>
          <Field label="Extra minutes per open order" hint="Busy store? Each queued order pushes the estimate out."><Input type="number" min={0} max={120} value={value.queue_min_per_order} onChange={(e) => set('queue_min_per_order', num(e.target.value, 120))} /></Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold text-forest">Pickup time slots</legend>
        <Toggle label="Let buyers choose a pickup time slot" checked={value.slots_enabled} onChange={(v) => set('slots_enabled', v)} />
        {value.slots_enabled && (
          <div className="space-y-3">
            <SlotBuilder slots={value.slots} onChange={(s) => set('slots', s)} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Days ahead (0 = today only)"><Input type="number" min={0} max={7} value={value.slot_days_ahead} onChange={(e) => set('slot_days_ahead', num(e.target.value, 7))} /></Field>
              <Field label="Orders per slot" hint="0 means unlimited."><Input type="number" min={0} max={200} value={value.slot_capacity} onChange={(e) => set('slot_capacity', num(e.target.value, 200))} /></Field>
              <Field label="Time zone offset (minutes from UTC)" hint="330 is India (IST)."><Input type="number" min={-720} max={840} value={value.utc_offset_min} onChange={(e) => set('utc_offset_min', Math.max(-720, Math.min(840, Number(e.target.value) || 0)))} /></Field>
            </div>
            <Toggle label="A slot is required to place an order" checked={value.slot_required} onChange={(v) => set('slot_required', v)} />
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold text-forest">Checkout questions</legend>
        <QuestionEditor fields={value.custom_fields} onChange={(f) => set('custom_fields', f)} />
        <Field label="Message shown at checkout (optional)"><Textarea maxLength={300} className="min-h-16" value={value.order_instructions} onChange={(e) => set('order_instructions', e.target.value)} placeholder="e.g. Bring your ID card when you collect." /></Field>
      </fieldset>
    </div>
  )
}
