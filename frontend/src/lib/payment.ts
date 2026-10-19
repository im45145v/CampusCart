export function openPaymentPage(url: string, popup: Window | null): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
  if (popup && !popup.closed) {
    popup.location.replace(parsed.href)
    popup.opener = null
    return true
  }
  window.location.assign(parsed.href)
  return true
}
