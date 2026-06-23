#!/bin/sh
# Replaces the placeholder tokens that were baked into the production build
# (see app/.env.production) with the real values provided at runtime by
# Kubernetes (ConfigMap). This lets one image be configured per environment.
set -eu

PLACEHOLDERS="FRONTEND_MS_ACCOUNT_HOLDINGS FRONTEND_MS_ACCOUNT_FRIENDS FRONTEND_MS_BUYSELL_BUY FRONTEND_MS_BUYSELL_SELL FRONTEND_MS_SENDRECEIVE_SEND"

for placeholder in $PLACEHOLDERS; do
  value=$(printenv "$placeholder" || true)
  if [ -n "$value" ]; then
    echo "inject-env: $placeholder -> $value"
    find /usr/share/nginx/html -type f -name '*.js' \
      -exec sed -i "s|$placeholder|$value|g" {} +
  else
    echo "inject-env: WARNING $placeholder not set"
  fi
done
