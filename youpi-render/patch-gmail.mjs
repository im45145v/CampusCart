import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

const serverPath = '/opt/youpi/apps/gmail-observer/src/server.js'
const indexPath = '/opt/youpi/apps/gmail-observer/src/index.js'

function mustReplace(path, from, to) {
  if (!fs.existsSync(path)) return
  const source = fs.readFileSync(path, 'utf8')
  if (source.includes(to)) return
  if (!source.includes(from)) {
    console.error(`Patch target was not found in ${path}`)
    process.exit(1)
  }
  fs.writeFileSync(path, source.replace(from, to))
}

mustReplace(
  serverPath,
  `          } catch (e) {
            console.error('[Gmail Observer] Failed to persist credentials to payment-api:', e.message);
          }

          this.poller.setCredentials({`,
  `          } catch (e) {
            console.error('[Gmail Observer] Failed to persist credentials to payment-api:', e.message);
          }

          try {
            const hook = process.env.COIN_STORE_WEBHOOK_URL || ''
            const keepUrl = hook.replace(/\\/api\\/payments\\/youpi\\/?$/, '/api/payments/youpi/gmail')
            const keepSecret = process.env.COIN_STORE_WEBHOOK_SECRET || ''
            if (keepUrl.startsWith('https://') && keepSecret && tokenData.refresh_token) {
              const kept = await fetch(keepUrl, {
                method: 'PUT',
                headers: {
                  'content-type': 'application/json',
                  'x-merchant-key': keepSecret,
                },
                body: JSON.stringify({
                  refresh_token: tokenData.refresh_token,
                  connected_email: userEmail || '',
                }),
              })
              if (!kept.ok) console.error('[Gmail Observer] Could not keep the Google connection for the next restart')
              else console.log('[Gmail Observer] Google connection kept for the next restart')
            }
          } catch {
            console.error('[Gmail Observer] Could not keep the Google connection for the next restart')
          }

          this.poller.setCredentials({`,
)

mustReplace(
  indexPath,
  `      console.log(\`[Gmail Observer] Service listening on port \${finalPort}\`);
      resolve({`,
  `      console.log(\`[Gmail Observer] Service listening on port \${finalPort}\`);
      poller.fetchCredentialsFromPaymentApi().then(() => {
        if (poller.credentials?.refreshToken) poller.start();
      }).catch(() => {});
      resolve({`,
)

async function restore() {
  const secret = (process.env.COIN_STORE_WEBHOOK_SECRET || '').trim()
  const hook = (process.env.COIN_STORE_WEBHOOK_URL || '').trim()
  const keepUrl = hook.replace(/\/api\/payments\/youpi\/?$/, '/api/payments/youpi/gmail')
  if (!secret || !keepUrl.startsWith('https://')) {
    console.log('gmail restore skipped')
    return
  }
  let response
  try {
    response = await fetch(keepUrl, { headers: { 'x-merchant-key': secret } })
  } catch {
    console.error('gmail restore did not reach UniCart')
    return
  }
  if (response.status === 404) {
    console.log('gmail not connected yet')
    return
  }
  if (!response.ok) {
    console.error('gmail restore failed')
    return
  }
  const saved = await response.json()
  const refresh = String(saved.refresh_token || '').trim()
  if (!refresh) return
  const dbPath = process.env.SQLITE_DB_PATH || '/tmp/youpi_pg.sqlite'
  if (!fs.existsSync(dbPath)) return
  const db = new DatabaseSync(dbPath)
  const row = db.prepare('SELECT id, branding FROM merchants LIMIT 1').get()
  if (!row) return
  const branding = JSON.parse(row.branding || '{}')
  const current = branding.gmailConfig && typeof branding.gmailConfig === 'object' ? branding.gmailConfig : {}
  let seal = (value) => value
  try {
    const mod = await import('@youpi/common')
    if (typeof mod.encryptAtRest === 'function') {
      const encrypt = mod.encryptAtRest
      seal = (value) => {
        try {
          return value ? encrypt(value) : value
        } catch {
          return value
        }
      }
    }
  } catch {
    // A plaintext value still loads. The reader accepts credentials stored that way.
  }
  branding.gmailConfig = {
    ...current,
    clientId: (process.env.GMAIL_CLIENT_ID || current.clientId || '').trim(),
    clientSecret: seal((process.env.GMAIL_CLIENT_SECRET || '').trim() || current.clientSecret || ''),
    refreshToken: seal(refresh),
    connectedEmail: String(saved.connected_email || current.connectedEmail || ''),
  }
  db.prepare('UPDATE merchants SET branding = ? WHERE id = ?').run(JSON.stringify(branding), row.id)
  console.log('gmail connection restored')
}

if (process.argv.includes('restore')) {
  try {
    await restore()
  } catch {
    console.error('gmail restore failed')
  }
}
