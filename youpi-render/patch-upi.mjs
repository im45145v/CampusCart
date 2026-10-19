import { DatabaseSync } from 'node:sqlite'

const upi = (process.env.YOUPI_UPI_ID || '').trim()
const name = (process.env.YOUPI_UPI_NAME || 'UniCart').trim()
if (!upi || !upi.includes('@')) {
  console.error('YOUPI_UPI_ID is missing')
  process.exit(1)
}
const db = new DatabaseSync(process.env.SQLITE_DB_PATH || '/tmp/youpi_pg.sqlite')
const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'payment_receiving_accounts'").get()
if (!table) process.exit(1)
const result = db.prepare('UPDATE payment_receiving_accounts SET upi_id = ?, payee_name = ?').run(upi, name)
if (result.changes < 1) process.exit(1)
const merchants = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'merchants'").get()
if (merchants) {
  db.prepare('UPDATE merchants SET business_name = ?').run(name)
}
console.log('receiving UPI set')
