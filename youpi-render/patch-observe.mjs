import fs from 'node:fs'

const pollerPath = '/opt/youpi/apps/gmail-observer/src/gmail-poller.js'
const routesPath = '/opt/youpi/apps/payment-api/src/routes/checkout.routes.js'
const attributionPaths = [
  '/opt/youpi/packages/core/src/attribution-engine.js',
  '/opt/youpi/node_modules/@youpi/core/src/attribution-engine.js',
].filter((path) => fs.existsSync(path))
if (attributionPaths.length === 0) {
  console.error('Attribution engine was not found')
  process.exit(1)
}

function mustReplace(path, from, to) {
  const source = fs.readFileSync(path, 'utf8')
  if (source.includes(to)) return
  if (!source.includes(from)) {
    console.error(`Patch target was not found in ${path}`)
    process.exit(1)
  }
  fs.writeFileSync(path, source.replaceAll(from, to))
}

// The HDFC credit mail uses the subject "Account update", which the old search skipped.
mustReplace(
  pollerPath,
  `const query = encodeURIComponent('subject:(credit OR credited OR received OR upi OR deposit OR alert)');`,
  `const query = encodeURIComponent('newer_than:2d (from:hdfcbank.bank.in OR from:hdfcbank OR subject:"account update" OR subject:credited OR subject:upi OR subject:deposit)');`,
)

mustReplace(
  pollerPath,
  `    let parsed = null;
    try {
      parsed = BankEmailParser.parse(email);
    } catch {}

    let targetAccountId = this.receivingAccountId;`,
  `    let parsed = null;
    try {
      parsed = BankEmailParser.parse(email);
    } catch {}
    if (!parsed) return { skipped: true };

    let targetAccountId = this.receivingAccountId;`,
)

// A guest checkout stays INITIATED until the bank alert arrives. Open the slot, then
// accept an alert that came in after the checkout was created.
for (const attributionPath of attributionPaths) {
  mustReplace(
    attributionPath,
    `        WHERE receiving_account_id = ? AND status IN ('ACTIVE', 'PROCESSING') AND amount_paise = ?`,
    `        WHERE receiving_account_id = ? AND status IN ('ACTIVE', 'PROCESSING', 'INITIATED') AND amount_paise = ?`,
  )

  mustReplace(
    attributionPath,
    `          AND status IN ('ACTIVE', 'PROCESSING')`,
    `          AND status IN ('ACTIVE', 'PROCESSING', 'INITIATED')`,
  )

  mustReplace(
    attributionPath,
    `      const isEligibleStatus = [PaymentStatus.ACTIVE, PaymentStatus.PROCESSING].includes(currentSession.status);`,
    `      if (currentSession.status === PaymentStatus.INITIATED && currentSession.amountPaise === normalizedObs.amountPaise && currentSession.receivingAccountId) {
        try {
          this.sessionRepo.acquireSlotAtomic(currentSession.id, currentSession.receivingAccountId, 300000);
          currentSession = this.sessionRepo.findById(currentSession.id) || currentSession;
        } catch (err) {
          console.warn('[attribution] could not open the payment window', err.message);
        }
      }

      const isEligibleStatus = [PaymentStatus.ACTIVE, PaymentStatus.PROCESSING].includes(currentSession.status);`,
  )

  mustReplace(
    attributionPath,
    `      const slotStart = currentSession.slotAcquiredAt
        ? new Date(currentSession.slotAcquiredAt.getTime() - 300000)
        : new Date(currentSession.createdAt.getTime() - 300000);`,
    `      const createdMs = currentSession.createdAt ? currentSession.createdAt.getTime() : Date.now();
      const slotMs = currentSession.slotAcquiredAt ? currentSession.slotAcquiredAt.getTime() : createdMs;
      const slotStart = new Date(Math.min(createdMs, slotMs) - 300000);`,
  )
}

mustReplace(
  routesPath,
  `    let timeRemainingSeconds = 0;
    if (session.status === PaymentStatus.ACTIVE && session.expiresAt) {`,
  `    if (session.status === PaymentStatus.INITIATED && receivingAccount?.id && ctx.queueEngine) {
      try {
        ctx.queueEngine.enqueueOrActivate(session.id, receivingAccount.id);
        const refreshed = ctx.sessionRepo.findById(session.id);
        if (refreshed) session = refreshed;
      } catch (err) {
        console.warn('[checkout] could not open the payment window', err.message);
      }
    }

    let timeRemainingSeconds = 0;
    if (session.status === PaymentStatus.ACTIVE && session.expiresAt) {`,
)

console.log('Bank alerts can finish an open checkout')
