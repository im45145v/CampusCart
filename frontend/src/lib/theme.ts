import type { CSSProperties } from 'react'
import type { OrderSettings, StoreTheme } from './types'

export const DEFAULT_ORDER_SETTINGS: OrderSettings = {
  fulfillment_options: ['pickup', 'campus_meetup'], payment_options: ['pay_on_pickup', 'manual_confirmation'],
  slots_enabled: false, slots: [], slot_required: true, slot_days_ahead: 1, slot_capacity: 0, utc_offset_min: 330,
  max_qty_per_item: 99, min_order_minor: 0, lead_time_min: 0, queue_min_per_order: 0, order_instructions: '', custom_fields: [],
}

export const DEFAULT_THEME: StoreTheme = {
  primary: '#6F4E37', accent: '#2C1810', background: '#F6F0E6', font: 'modern', radius: 'soft',
}

export const THEME_PRESETS: { name: string; theme: StoreTheme }[] = [
  { name: 'Desk coffee', theme: DEFAULT_THEME },
  { name: 'Campus teal', theme: { primary: '#0E6E62', accent: '#12312C', background: '#F3F6F4', font: 'modern', radius: 'soft' } },
  { name: 'Warm clay', theme: { primary: '#C65D3A', accent: '#263D32', background: '#F7F4ED', font: 'modern', radius: 'soft' } },
  { name: 'Coffee house', theme: { primary: '#8B5A2B', accent: '#3E2A1C', background: '#F5EEE4', font: 'serif', radius: 'soft' } },
  { name: 'Fresh mint', theme: { primary: '#1F9D78', accent: '#0F3D3E', background: '#EEF8F4', font: 'rounded', radius: 'pill' } },
  { name: 'Ink and print', theme: { primary: '#2F5BEA', accent: '#16213E', background: '#F3F5FA', font: 'modern', radius: 'sharp' } },
  { name: 'Sunset', theme: { primary: '#E0513B', accent: '#5B1F3A', background: '#FFF4EC', font: 'rounded', radius: 'pill' } },
]

const FONTS: Record<StoreTheme['font'], string> = {
  modern: "'Manrope Variable', system-ui, sans-serif",
  serif: "ui-serif, Georgia, 'Times New Roman', serif",
  rounded: "ui-rounded, 'Manrope Variable', system-ui, sans-serif",
}
const RADII: Record<StoreTheme['radius'], [string, string, string]> = {
  sharp: ['0.125rem', '0.25rem', '0.25rem'],
  soft: ['0.5rem', '0.75rem', '1rem'],
  pill: ['0.75rem', '1.25rem', '1.75rem'],
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function shade(hex: string, amount: number): string {
  const [r, g, b] = rgb(hex).map((c) => Math.max(0, Math.min(255, Math.round(c * (1 + amount)))))
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** CSS variable overrides: Tailwind utilities read these, so a wrapper re-themes everything inside it. */
export function themeStyle(theme: StoreTheme | undefined): CSSProperties {
  const t = { ...DEFAULT_THEME, ...theme }
  const [lg, xl, xxl] = RADII[t.radius]
  const onPrimary = contrast('#ffffff', t.primary) >= contrast('#2C1810', t.primary) ? '#ffffff' : '#2C1810'
  return {
    '--color-terracotta': t.primary,
    '--color-terracotta-dark': shade(t.primary, -0.18),
    '--color-forest': t.accent,
    '--color-ivory': t.background,
    '--color-on-primary': onPrimary,
    '--font-heading': FONTS[t.font],
    '--radius-lg': lg,
    '--radius-xl': xl,
    '--radius-2xl': xxl,
  } as CSSProperties
}
