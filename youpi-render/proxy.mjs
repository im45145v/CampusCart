import http from 'node:http'

const port = Number(process.env.PORT || 10000)
const checkoutPort = Number(process.env.CHECKOUT_PORTAL_PORT || 7000)
const gmailPort = Number(process.env.GMAIL_OBSERVER_PORT || 6003)
const smsPort = Number(process.env.SMS_OBSERVER_PORT || 6002)
const blocked = [/\/confirm-cod\/?$/, /\/simulate-observation\/?$/]

function targetPort(path) {
  if (path === '/oauth' || path.startsWith('/oauth/')) return gmailPort
  return checkoutPort
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
  if (blocked.some((rule) => rule.test(path))) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found')
    return
  }
  const target = targetPort(path)
  const headers = { ...req.headers, host: `127.0.0.1:${target}` }
  const upstream = http.request(
    { hostname: '127.0.0.1', port: target, path: req.url, method: req.method, headers },
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
