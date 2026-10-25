#!/bin/sh
# Pull-based roll-out, run on the server by cron.
#
# GitHub's runners cannot open SSH to this VPS, so the server watches the
# repository itself: every couple of minutes this script copies the compose
# file from main, pulls the images the workflow published and recreates only
# the containers whose image changed. It is safe to run at any time.
set -eu

cd "$(dirname "$0")"

RAW="https://raw.githubusercontent.com/abmak/communityhubaddisweg/main/deploy"
COMPOSE="docker compose -f docker-compose.prod.yml"
API_IMAGE="ghcr.io/abmak/communityhubaddisweg/api:latest"
WEB_IMAGE="ghcr.io/abmak/communityhubaddisweg/web:latest"

value() { sed -n "s|^$1=||p" .env | tail -n 1; }
set_value() {
  if grep -q "^$1=" .env; then
    sed -i "s|^$1=.*|$1=$2|" .env
  else
    printf '%s=%s\n' "$1" "$2" >>.env
  fi
}

[ -f .env ] || cp .env.example .env

# Follow the repository's compose file; a stale copy would roll the stack back.
tmp="$(mktemp)"
if curl -fsS --max-time 30 "$RAW/docker-compose.prod.yml" -o "$tmp"; then
  if ! cmp -s "$tmp" docker-compose.prod.yml; then
    mv "$tmp" docker-compose.prod.yml
    echo "$(date -Is) compose file updated from main"
  else
    rm -f "$tmp"
  fi
else
  rm -f "$tmp"
  echo "$(date -Is) could not reach GitHub, keeping the local compose file" >&2
fi

# The workflow moves these tags on every build, so roll-outs need no pinning.
[ "$(value API_IMAGE)" = "$API_IMAGE" ] || set_value API_IMAGE "$API_IMAGE"
[ "$(value WEB_IMAGE)" = "$WEB_IMAGE" ] || set_value WEB_IMAGE "$WEB_IMAGE"

# Without a domain Caddy is off and the web container is the public entry
# point, so it has to bind beyond loopback.
if [ -z "$(value DOMAIN)" ]; then
  export WEB_BIND=0.0.0.0
fi

$COMPOSE pull -q

# Stay quiet unless the roll-out changed something; cron would otherwise fill
# the log with "Container ... Running" every couple of minutes.
out="$(mktemp)"
trap 'rm -f "$out"' EXIT
if ! $COMPOSE up -d --remove-orphans >"$out" 2>&1; then
  echo "$(date -Is) roll-out failed"
  cat "$out"
  exit 1
fi
if grep -qiE 'recreated|created|started|error' "$out"; then
  echo "$(date -Is) roll-out applied"
  cat "$out"
fi

# Drop the release the stack just stopped using. `-a` only touches images no
# container references, which on this host is the previous release.
docker image prune -a -f >/dev/null 2>&1 || true
