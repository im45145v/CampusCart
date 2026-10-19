#!/bin/bash
set -euo pipefail
cd /opt/youpi
export USE_SQLITE_FALLBACK=true
export SQLITE_DB_PATH=/tmp/youpi_pg.sqlite
export NODE_ENV=production
export PAYMENT_API_PORT=6100
export CHECKOUT_PORTAL_PORT=7000
export BASE_PAYMENT_API_URL=http://127.0.0.1:6100
export BASE_CHECKOUT_URL="${RENDER_EXTERNAL_URL:-http://127.0.0.1:${PORT}}"
host="${BASE_CHECKOUT_URL#https://}"
host="${host#http://}"
host="${host%%/*}"
export DEPLOYMENT_PREFIX="${host%%.*}"
export CLOUDFLARE_DOMAIN="${host#*.}"
export YOUPI_MODE=production
export YOUPI_BIND_HOST=127.0.0.1
export GMAIL_OBSERVER_PORT="${GMAIL_OBSERVER_PORT:-6003}"
export SMS_OBSERVER_PORT="${SMS_OBSERVER_PORT:-6002}"
export GMAIL_REDIRECT_URI="${GMAIL_REDIRECT_URI:-${BASE_CHECKOUT_URL}/oauth/callback}"

secret_dir=/opt/youpi/data/.secrets
mkdir -p "$secret_dir"
token_file="$secret_dir/observer_api_token"
if [ ! -s "$token_file" ]; then
  node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))" > "$token_file"
  chmod 600 "$token_file"
fi
OBSERVER_API_TOKEN="$(cat "$token_file")"
export OBSERVER_API_TOKEN

node /opt/render/patch-health.mjs
node /opt/render/patch-guest.mjs
node /opt/render/patch-observe.mjs

node apps/payment-api/src/index.js &
ready=0
for _ in $(seq 1 40); do
  if node /opt/render/patch-upi.mjs; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" != 1 ]; then
  echo "YouPI database did not accept the receiving UPI"
  exit 1
fi

node apps/gmail-observer/src/index.js &
node apps/sms-observer/src/index.js &

wait_observer() {
  local port="$1"
  local name="$2"
  for _ in $(seq 1 30); do
    if node --input-type=module -e "const r = await fetch('http://127.0.0.1:${port}/health'); if (!r.ok) process.exit(1)"; then
      echo "${name} listening on ${port}"
      return 0
    fi
    sleep 1
  done
  echo "${name} did not open port ${port}"
  return 1
}

wait_observer "$GMAIL_OBSERVER_PORT" "Gmail observer"
wait_observer "$SMS_OBSERVER_PORT" "SMS observer"

node apps/checkout-portal/src/index.js &
exec node /opt/render/proxy.mjs
