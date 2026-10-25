#!/bin/sh
# Runs on the VPS from the deploy directory. Idempotent: the first run writes
# .env from .env.example and fills the secrets, later runs only pull the images
# the workflow built and recreate the containers that changed.
#
# The pipeline calls it with API_IMAGE / WEB_IMAGE (commit-pinned tags) and,
# for a private GHCR package, GHCR_USER / GHCR_TOKEN.
set -eu

cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.prod.yml"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

value() { sed -n "s|^$1=||p" .env | tail -n 1; }
hex() { od -An -tx1 -N "$1" /dev/urandom | tr -d ' \n'; }

set_value() {
  if grep -q "^$1=" .env; then
    sed -i "s|^$1=.*|$1=$2|" .env
  else
    printf '%s=%s\n' "$1" "$2" >>.env
  fi
}

# --- First-run secrets ------------------------------------------------------
if [ -z "$(value POSTGRES_PASSWORD)" ]; then
  set_value POSTGRES_PASSWORD "$(hex 24)"
  echo "Generated POSTGRES_PASSWORD"
fi

if [ -z "$(value DATABASE_URL)" ]; then
  db_user="$(value POSTGRES_USER)"
  db_name="$(value POSTGRES_DB)"
  set_value DATABASE_URL \
    "postgresql://${db_user:-communityhub}:$(value POSTGRES_PASSWORD)@db:5432/${db_name:-communityhub}?schema=public"
fi

if [ -z "$(value JWT_SECRET)" ]; then
  set_value JWT_SECRET "$(hex 48)"
  echo "Generated JWT_SECRET"
fi

if [ -z "$(value CLIENT_ORIGIN)" ] && [ -n "$(value DOMAIN)" ]; then
  set_value CLIENT_ORIGIN "https://$(value DOMAIN)"
fi

# --- Registry ---------------------------------------------------------------
if [ -n "${GHCR_TOKEN:-}" ]; then
  printf '%s' "$GHCR_TOKEN" |
    docker login ghcr.io -u "${GHCR_USER:-github-actions[bot]}" --password-stdin >/dev/null
  echo "Logged in to ghcr.io"
fi

if [ -n "${API_IMAGE:-}" ]; then
  set_value API_IMAGE "$API_IMAGE"
fi
if [ -n "${WEB_IMAGE:-}" ]; then
  set_value WEB_IMAGE "$WEB_IMAGE"
fi

# --- Roll out ---------------------------------------------------------------
profile=""
if [ -n "$(value DOMAIN)" ]; then
  profile="--profile tls"
else
  # Without Caddy the web container is the only entry point, so it has to be
  # reachable from outside instead of the loopback default in .env.
  export WEB_BIND="${WEB_BIND:-0.0.0.0}"
  # No TLS means a Secure cookie is silently dropped by the browser and every
  # like or comment would look signed out.
  set_value COOKIE_SECURE false
fi

# shellcheck disable=SC2086
$COMPOSE $profile pull
# shellcheck disable=SC2086
$COMPOSE $profile up -d --remove-orphans

# Drop images that no container references any more, keeping the last few days
# of rollback material.
docker image prune -f --filter "until=168h" >/dev/null 2>&1 || true

# --- Smoke test -------------------------------------------------------------
port="$(value WEB_PORT)"
port="${port:-8080}"
scheme="http"
host="127.0.0.1:${port}"
if [ -n "$(value DOMAIN)" ]; then
  scheme="https"
  host="$(value DOMAIN)"
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Deployed (curl is not installed, so the HTTP smoke test was skipped)."
  exit 0
fi

if [ -z "$(value DOMAIN)" ]; then
  echo "Warning: DOMAIN is empty, so the stack runs over HTTP only and session" >&2
  echo "cookies are not marked Secure. Set DOMAIN in $(pwd)/.env for HTTPS." >&2
fi

attempt=1
while [ "$attempt" -le 20 ]; do
  if curl -fsS --max-time 5 "$scheme://$host/" >/dev/null 2>&1; then
    echo "Deployed: $scheme://$host"
    exit 0
  fi
  attempt=$((attempt + 1))
  sleep 3
done

echo "Containers started, but $scheme://$host did not answer within 60s." >&2
$COMPOSE $profile ps >&2 || true
exit 1
