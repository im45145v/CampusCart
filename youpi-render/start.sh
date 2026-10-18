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

node apps/checkout-portal/src/index.js &
exec node /opt/render/proxy.mjs
