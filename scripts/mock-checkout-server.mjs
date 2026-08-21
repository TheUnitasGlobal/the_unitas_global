import http from 'node:http'

const port = Number(process.env.MOCK_CHECKOUT_PORT ?? 54321)
const allowedModules = new Set(['Arche', 'Arena', 'Score', 'Fate', 'Codex22'])

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url?.startsWith('/mock-stripe/')) {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Local mock Stripe Checkout session')
    return
  }

  if (request.method !== 'POST' || request.url !== '/functions/v1/create-checkout-session') {
    response.writeHead(404, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  let body = ''
  request.setEncoding('utf8')
  request.on('data', (chunk) => { body += chunk })
  request.on('end', () => {
    try {
      const payload = JSON.parse(body)
      if (!allowedModules.has(payload.module)) {
        response.writeHead(400, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: 'Unknown module' }))
        return
      }

      const checkoutUrl = `http://127.0.0.1:${port}/mock-stripe/${encodeURIComponent(payload.module)}`
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ url: checkoutUrl, module: payload.module, mode: 'subscription' }))
    } catch {
      response.writeHead(400, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'Invalid JSON' }))
    }
  })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Mock checkout server listening on http://127.0.0.1:${port}`)
})
