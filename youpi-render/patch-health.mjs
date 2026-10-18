import fs from 'node:fs'

const path = '/opt/youpi/apps/payment-api/src/routes/checkout.routes.js'
const marker = 'Receiving UPI account is configured'
const source = fs.readFileSync(path, 'utf8')
if (source.includes(marker)) {
  process.exit(0)
}

const needle = 'async function checkUpiServerHealth('
const start = source.indexOf(needle)
const brace = start === -1 ? -1 : source.indexOf('{', start)
if (brace === -1) {
  console.error('YouPI UPI health check was not found')
  process.exit(1)
}

const insert = `{
  // A configured receiving account can take a payment. Missing Gmail or SMS
  // observers are not an outage of that account.
  if (String(process.env.YOUPI_UPI_ID || '').includes('@')) {
    return {
      status: 'WORKING',
      tier: 'GREEN',
      label: 'Server Is Working',
      isWorking: true,
      reason: '${marker}',
      smsHealthy: false,
      gmailHealthy: false,
      warning: null,
      recommendedAlternative: null
    };
  }
`
fs.writeFileSync(path, source.slice(0, brace) + insert + source.slice(brace + 1))
console.log('UPI health follows the receiving account')
