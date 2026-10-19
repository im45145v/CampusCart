import fs from 'node:fs'
import http from 'node:http'

const port = Number(process.env.PORT || 10000)
const checkoutPort = Number(process.env.CHECKOUT_PORTAL_PORT || 7000)
const gmailPort = Number(process.env.GMAIL_OBSERVER_PORT || 6003)
const smsPort = Number(process.env.SMS_OBSERVER_PORT || 6002)
const adminPort = Number(process.env.MERCHANT_ADMIN_PORT || 6001)
const blocked = [/\/confirm-cod\/?$/, /\/simulate-observation\/?$/]
const adminPaths = new Set([
  '/admin',
  '/admin/',
  '/dashboard',
  '/dashboard/',
  '/merchant',
  '/merchant/',
  '/merchant-admin',
  '/merchant-admin/',
])

function targetPort(path) {
  if (path === '/oauth' || path.startsWith('/oauth/')) return gmailPort
  if (adminPaths.has(path) || path === '/youpi-sms-gateway.apk') return adminPort
  return checkoutPort
}

function upstreamUrl(path, rawUrl) {
  if (!adminPaths.has(path)) return rawUrl
  const query = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?')) : ''
  return `/admin${query}`
}

async function observerHealth(_req, res) {
  async function probe(name, observerPort) {
    try {
      const response = await fetch(`http://127.0.0.1:${observerPort}/health`)
      const body = await response.json()
      return { name, up: response.ok, body }
    } catch {
      return { name, up: false }
    }
  }
  const observers = await Promise.all([
    probe('gmail', gmailPort),
    probe('sms', smsPort),
  ])
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ observers }))
}

function observerToken() {
  const fromEnv = (process.env.OBSERVER_API_TOKEN || '').trim()
  if (fromEnv) return fromEnv
  const paths = [
    '/opt/youpi/data/.secrets/observer_api_token',
    '/opt/youpi/node_modules/data/.secrets/observer_api_token',
  ]
  for (const path of paths) {
    try {
      const value = fs.readFileSync(path, 'utf8').trim()
      if (value) return value
    } catch {
      // The next location may hold the token.
    }
  }
  return ''
}

async function startGmailConnect(_req, res) {
  const token = observerToken()
  if (!token) {
    res.writeHead(503, { 'content-type': 'text/plain' })
    res.end('Gmail connect is not ready')
    return
  }
  try {
    const response = await fetch(`http://127.0.0.1:${gmailPort}/oauth/url`, {
      headers: { authorization: `Bearer ${token}` },
    })
    const body = await response.json()
    const authUrl = new URL(String(body.authUrl || ''))
    if (!response.ok || authUrl.origin !== 'https://accounts.google.com') {
      res.writeHead(502, { 'content-type': 'text/plain' })
      res.end('Gmail connect did not start')
      return
    }
    res.writeHead(302, { location: authUrl.href })
    res.end()
  } catch {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' })
    res.end('Gmail connect did not start')
  }
}

const server = http.createServer((req, res) => {
  const path = (req.url || '/').split('?')[0]
  if (req.method === 'GET' && (path === '/' || path === '/health')) {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('ok')
    return
  }
  if (req.method === 'GET' && path === '/health/observers') {
    void observerHealth(req, res)
    return
  }
  if (req.method === 'GET' && path === '/oauth/connect') {
    void startGmailConnect(req, res)
    return
  }
  if (blocked.some((rule) => rule.test(path))) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found')
    return
  }
  const target = targetPort(path)
  const headers = { ...req.headers, host: `127.0.0.1:${target}` }
  const upstream = http.request(
    { hostname: '127.0.0.1', port: target, path: upstreamUrl(path, req.url || '/'), method: req.method, headers },
    (response) => {
      res.writeHead(response.statusCode || 502, response.headers)
      response.pipe(res)
    },
  )
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' })
    res.end('youpi is starting')
  })
  req.pipe(upstream)
})

server.listen(port, '0.0.0.0')
