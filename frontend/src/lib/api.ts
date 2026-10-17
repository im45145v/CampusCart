const BASE = import.meta.env.VITE_API_URL ?? ''
const TOKEN_KEY = 'campuscart.token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function detailMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown })?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg)
  return fallback
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; form?: FormData; params?: Record<string, string | number | boolean | undefined> } = {},
): Promise<T> {
  const qs = opts.params
    ? '?' + new URLSearchParams(
        Object.entries(opts.params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]),
      ).toString()
    : ''
  const headers: Record<string, string> = {}
  const token = tokenStore.get()
  if (token) headers.Authorization = 'Bearer ' + token
  let body: BodyInit | undefined
  if (opts.form) body = opts.form
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  let res: Response
  try {
    res = await fetch(`${BASE}${path}${qs === '?' ? '' : qs}`, { method: opts.method ?? 'GET', headers, body })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.')
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, detailMessage(data, `Request failed (${res.status})`))
  return data as T
}

export function wsUrl(ticket: string): string {
  const base = BASE || window.location.origin
  return base.replace(/^http/, 'ws') + `/ws/chat?ticket=${encodeURIComponent(ticket)}`
}
