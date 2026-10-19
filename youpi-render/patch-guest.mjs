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
  htmlPath,
  `        if (!res.ok) {
          dismissSplashScreen();
          return;
        }`,
  `        if (!res.ok) {
          const body = document.querySelector('.ypg-body');
          if (body && !document.getElementById('missingCheckout')) {
            const note = document.createElement('div');
            note.id = 'missingCheckout';
            note.style.cssText = 'padding:28px 8px;text-align:center;';
            note.innerHTML = '<h2 style="font-size:22px;font-weight:800;margin:0 0 8px;">This payment page expired</h2><p style="color:#64748b;margin:0 0 16px;">Go back to UniCart and start the payment again.</p><a href="https://campuscart-web-h46s.onrender.com/account" style="display:inline-block;background:#0b63e5;color:#fff;font-weight:700;padding:12px 18px;border-radius:10px;text-decoration:none;">Back to wallet</a>';
            body.prepend(note);
          }
          dismissSplashScreen();
          return;
        }`,
)

mustReplace(
  routesPath,
  'if (session.status === PaymentStatus.ACTIVE && payeeVpa) {',
  'if ((session.status === PaymentStatus.ACTIVE || session.status === PaymentStatus.INITIATED) && payeeVpa) {',
)

console.log('Checkout opens the UPI QR without WhatsApp OTP')
