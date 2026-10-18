import fs from 'node:fs'

const htmlPath = '/opt/youpi/apps/checkout-portal/src/views/checkout.html'
const routesPath = '/opt/youpi/apps/payment-api/src/routes/checkout.routes.js'
const marker = 'Guest checkout skips WhatsApp OTP'

function mustReplace(path, from, to) {
  const source = fs.readFileSync(path, 'utf8')
  if (source.includes(to)) return
  if (!source.includes(from)) {
    console.error(`Patch target was not found in ${path}`)
    process.exit(1)
  }
  fs.writeFileSync(path, source.replaceAll(from, to))
}

mustReplace(
  htmlPath,
  `      if (!hasCustomer) {
        setGatewayAuthMode(true);
        const stepMob = document.getElementById('authStepMobile');
        const isAlreadyOnMobile = stepMob && !stepMob.hidden;
        if (!currentAuthStep || (currentAuthStep === 'mobile' && !isAlreadyOnMobile)) {
          goToAuthStep('mobile');
        }
        renderSavedAccountsUI();
        return;
      }`,
  `      // ${marker}. The UPI QR is the payment step.
      if (!hasCustomer) {
        activeCustomer = null;
        activeToken = null;
      }`,
)

mustReplace(
  htmlPath,
  `              clearPreservedIdentity();
              activeCustomer = null;
              activeToken = null;
              setGatewayAuthMode(true);
              goToAuthStep('mobile');
              renderSavedAccountsUI();`,
  `              clearPreservedIdentity();
              activeCustomer = null;
              activeToken = null;
              setGatewayAuthMode(false);`,
)

mustReplace(
  htmlPath,
  `      if (data.status === 'ACTIVE' || (data.status === 'INITIATED' && (data.timeRemainingSeconds > 0 || data.expiresAt))) {`,
  `      if (data.status === 'ACTIVE' || data.status === 'INITIATED') {`,
)

mustReplace(
  htmlPath,
  `          const remainingSec = (data.timeRemainingSeconds !== undefined && data.timeRemainingSeconds !== null) ? Number(data.timeRemainingSeconds) : 300;`,
  `          let remainingSec = (data.timeRemainingSeconds !== undefined && data.timeRemainingSeconds !== null) ? Number(data.timeRemainingSeconds) : 300;
          if (data.status === 'INITIATED' && remainingSec <= 0) remainingSec = 300;`,
)

mustReplace(
  routesPath,
  'if (session.status === PaymentStatus.ACTIVE && payeeVpa) {',
  'if ((session.status === PaymentStatus.ACTIVE || session.status === PaymentStatus.INITIATED) && payeeVpa) {',
)

console.log('Checkout opens the UPI QR without WhatsApp OTP')
