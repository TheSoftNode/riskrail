#!/usr/bin/env bash
# Creates .env.production on the server with fresh random secrets.
#
#   ./setup-env.sh <api-host> <realtime-host> <acme-email> <web-url>
#
# Secrets are generated here and never printed, so they exist only on this
# machine. Refuses to overwrite an existing file: replacing JWT_SECRET logs
# everyone out, and replacing WEBHOOK_ENCRYPTION_KEY makes every stored webhook
# secret undecryptable.
set -euo pipefail
cd "$(dirname "$0")"

if [ $# -ne 4 ]; then
  echo "usage: $0 <api-host> <realtime-host> <acme-email> <web-url>" >&2
  exit 1
fi
if [ -e .env.production ]; then
  echo ".env.production already exists; not overwriting it." >&2
  exit 1
fi

# 32 random bytes as hex. /dev/urandom and od exist on every Linux, unlike
# openssl on a minimal image; the length check turns any failure into an error
# instead of a silently empty secret.
secret() {
  local value
  value="$(head -c 32 /dev/urandom | od -An -v -tx1 | tr -d ' \n')"
  if [ "${#value}" -ne 64 ]; then
    echo "could not generate a secret" >&2
    exit 1
  fi
  printf '%s' "$value"
}

umask 077
sed \
  -e "s#__API_HOST__#$1#g" \
  -e "s#__REALTIME_HOST__#$2#g" \
  -e "s#__ACME_EMAIL__#$3#g" \
  -e "s#__WEB_URL__#$4#g" \
  env.production.template > .env.production.tmp

# Hex keeps every secret safe inside a URL (the database and Redis passwords).
while grep -q '__GENERATED__' .env.production.tmp; do
  value="$(secret)"
  sed -i "0,/__GENERATED__/s//${value}/" .env.production.tmp
done
if grep -Eq '^(POSTGRES_PASSWORD|REDIS_PASSWORD|JWT_SECRET|API_KEY_PEPPER|WEBHOOK_ENCRYPTION_KEY|CHAINHOOK_AUTH_TOKEN)=$' .env.production.tmp; then
  rm -f .env.production.tmp
  echo "a secret came out empty; nothing was written" >&2
  exit 1
fi
mv .env.production.tmp .env.production

echo "Wrote .env.production (mode 600). Secrets were generated and not printed."
echo "CHAINHOOK_AUTH_TOKEN is in that file; you will need it to register Chainhook."
