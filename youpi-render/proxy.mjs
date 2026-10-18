import http from 'node:http'

const port = Number(process.env.PORT || 10000)
const target = Number(process.env.CHECKOUT_PORTAL_PORT || 7000)
const blocked = [/\/confirm-cod\/?$/, /\/simulate-observation\/?$/]

const server = http.createServer((req, res) => {
  const path = (req.url || '/').split('?')[0]
  if (req.method === 'GET' && (path === '/' || path === '/health')) {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('ok')
    return
  }
  if (blocked.some((rule) => rule.test(path))) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found')
    return
  }
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
