import http from 'node:http'

const port = Number(process.env.MOCK_CHECKOUT_PORT ?? 54321)
const allowedModules = new Set(['Arche', 'Arena', 'Score', 'Fate', 'Codex22'])
const allowedBundles = new Set(['small', 'medium', 'large'])

function readJsonBody(request) {
  return new Promise((resolvePromise, rejectPromise) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => { body += chunk })
    request.on('end', () => {
      try {
        resolvePromise(JSON.parse(body))
      } catch (error) {
        rejectPromise(error)
      }
    })
  })
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url?.startsWith('/mock-stripe/')) {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Local mock Stripe Checkout session')
    return
  }

  // Active coin-core purchase contract (Rev 0).
  if (request.method === 'POST' && request.url === '/functions/v1/create-coin-checkout-session') {
    try {
      const payload = await readJsonBody(request)
      if (!allowedBundles.has(payload.bundle)) {
        response.writeHead(400, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: 'Unknown bundle' }))
        return
      }

      const checkoutUrl = `http://127.0.0.1:${port}/mock-stripe/${encodeURIComponent(payload.bundle)}`
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ url: checkoutUrl, bundle: payload.bundle, mode: 'payment' }))
    } catch {
      response.writeHead(400, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'Invalid JSON' }))
    }
    return
  }

  // Deprecated (Rev 0 coin-core) subscription contract, kept for the
  // dormant create-checkout-session/index.ts function to still mock against.
  if (request.method === 'POST' && request.url === '/functions/v1/create-checkout-session') {
    try {
      const payload = await readJsonBody(request)
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
    return
  }

  response.writeHead(404, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Mock checkout server listening on http://127.0.0.1:${port}`)
})
