#!/bin/sh
# HTTPS for the community hub on this server's public IP.
#
#   sudo sh ~/communityhub/https-setup.sh
#
# Ports 80 and 443 already belong to the host's nginx (other sites live
# there), so the compose Caddy can never bind them and this app has been on
# plain HTTP — where phones refuse to share their location. This script puts a
# TLS vhost in front of the web container and makes it the answer for the bare
# IP:
#
#   https://<public-ip>/          primary entry point
#   https://<public-ip>:8443/     kept as an alias for older links
#
# The certificate is a Let's Encrypt IP certificate. Let's Encrypt only issues
# those as six-day "shortlived" certificates, so a root cron entry renews it
# twice a day and reloads nginx. certbot needs 5.4+ for --ip-address with
# --webroot, hence the official image; it keeps its state in
# /etc/letsencrypt-ip so the system certbot (which manages the other sites)
# is left untouched.
#
# Port 443 is shared with the other vhosts on this box, which are keyed by
# server_name and keep working. The hub's block is `default_server`, because a
# browser sends no SNI for an IP literal and would otherwise land on whichever
# vhost nginx loaded first. The old bare-IP redirect to the VAS tracker is
# disabled (it stays reachable on https://<ip>:5000) and the bare-IP port-80
# block now redirects to the hub while still answering ACME challenges.
#
# Safe to re-run: nginx files are rewritten from here, .env is updated in
# place, and certbot reuses the existing certificate until it is due.
set -eu

[ "$(id -u)" -eq 0 ] || { echo "run this with root privileges: sudo sh $0" >&2; exit 1; }
command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }
command -v nginx >/dev/null || { echo "nginx is required" >&2; exit 1; }

cd "$(dirname "$0")"

IP="${1:-$(curl -fsS --max-time 10 https://api.ipify.org || true)}"
case "$IP" in
  "" | *[!0-9.]* | *..* | .* | *.)
    echo "could not determine a public IPv4 address (got '$IP'); pass it: sudo sh $0 203.0.113.5" >&2
    exit 1
    ;;
esac

PORT=8443
APP=127.0.0.1:8080
WEBROOT=/var/www/acme
VAS80=/etc/nginx/sites-available/vas-ip-redirect.conf
VAS443_ENABLED=/etc/nginx/sites-enabled/vas-ip-redirect-443
SITE=/etc/nginx/sites-available/communityhub-tls
ENABLED=/etc/nginx/sites-enabled/communityhub-tls
CERTDIR=/etc/letsencrypt-ip
IMAGE=certbot/certbot:latest
CERT="$CERTDIR/live/$IP/fullchain.pem"
KEY="$CERTDIR/live/$IP/privkey.pem"
BACKUP="/root/communityhub-nginx-backup-$(date +%Y%m%d%H%M%S)"

echo "• Certificate for $IP will be served on 443 (and $PORT)"

mkdir -p "$BACKUP"
[ -f "$SITE" ] && cp -a "$SITE" "$BACKUP/communityhub-tls"
[ -f "$VAS80" ] && cp -a "$VAS80" "$BACKUP/vas-ip-redirect.conf"
[ -e "$VAS443_ENABLED" ] && ls -l "$VAS443_ENABLED" >"$BACKUP/vas-ip-redirect-443.link" 2>&1 || true
echo "  nginx backups in $BACKUP"

# --- 1. Serve ACME challenges from disk ------------------------------------
install -d -m 755 "$WEBROOT/.well-known/acme-challenge"

# --- 2. Issue the IP certificate -------------------------------------------
echo "• Preparing certbot"
if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "  using the image already on the host"
else
  free_mb="$(df -Pm / | awk 'NR==2 {print $4}')"
  if [ "${free_mb:-0}" -lt 600 ]; then
    echo "Only ${free_mb} MB free on /; the certbot image needs about 600 MB." >&2
    echo "Free some space first, e.g.: sudo journalctl --vacuum-size=200M" >&2
    exit 1
  fi
  docker pull -q "$IMAGE" >/dev/null
fi

# update.sh prunes unused images every couple of minutes, and a *stopped*
# container does not protect one: this idle container keeps the image
# referenced, so the renewal job never has to pull ~250 MB onto a host that
# runs close to full. It is outside the compose project, so `up -d
# --remove-orphans` leaves it alone.
if [ "$(docker inspect -f '{{.State.Running}}' communityhub-certbot 2>/dev/null)" != "true" ]; then
  docker rm -f communityhub-certbot >/dev/null 2>&1 || true
  docker run -d --name communityhub-certbot --restart unless-stopped \
    --entrypoint sh "$IMAGE" -c 'while :; do sleep 3600; done' >/dev/null
fi

CB="$(docker run --rm "$IMAGE" --version | awk '{print $2}')"
CB_MAJOR="${CB%%.*}"
CB_MINOR="${CB#*.}"
CB_MINOR="${CB_MINOR%%.*}"
if [ "$CB_MAJOR" -lt 5 ] || { [ "$CB_MAJOR" -eq 5 ] && [ "$CB_MINOR" -lt 4 ]; }; then
  echo "certbot 5.4+ is required for IP certificates, the image has $CB" >&2
  exit 1
fi
echo "  certbot $CB"

if [ -s "$CERT" ] && [ -s "$KEY" ]; then
  echo "  reusing the certificate already in $CERTDIR"
else
  echo "• Requesting the certificate (HTTP-01 on port 80)"
  docker run --rm \
    -v "$CERTDIR":/etc/letsencrypt \
    -v "$WEBROOT":/var/www/acme \
    "$IMAGE" certonly \
    --webroot -w /var/www/acme \
    --ip-address "$IP" \
    --preferred-profile shortlived \
    --cert-name "$IP" \
    --non-interactive --agree-tos --register-unsafely-without-email
  [ -s "$CERT" ] && [ -s "$KEY" ] || { echo "certificate files are missing under $CERTDIR/live/$IP" >&2; exit 1; }
fi

# --- 3. Terminate TLS on the host nginx and proxy to the app ----------------
echo "• Writing the nginx vhost"
cat >"$SITE" <<EOF
# Managed by communityhub https-setup.sh — re-runs rewrite this file.
# HTTPS entry point for the community hub on the host's public IP. This is the
# default server on 443: a browser sends no SNI for an IP literal, so without
# default_server the request would land on whichever vhost nginx loaded first.
server {
    listen 443 ssl default_server;
    listen $PORT ssl;
    server_name $IP;

    ssl_certificate     $CERT;
    ssl_certificate_key $KEY;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:communityhub-tls:10m;
    ssl_session_timeout 1d;

    client_max_body_size 30m;

    location / {
        proxy_pass http://$APP;
        proxy_http_version 1.1;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        # Socket.IO upgrades and long polling.
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 600s;
    }
}
EOF

# The bare-IP port-80 block used to hand visitors to the VAS tracker. It now
# leads to the hub, but keeps serving / .well-known/acme-challenge/ from disk,
# which is what renewing the IP certificate needs.
cat >"$VAS80" <<EOF
# Bare-IP visitors -> the community hub over HTTPS (see communityhub-tls).
# Managed by communityhub https-setup.sh — re-runs rewrite this file.
# Named sites (jobsethiopia.et, LibLeeLeb subdomains) match their own
# server_name blocks first and are unaffected; the VAS tracker itself stays on
# https://$IP:5000.
server {
    listen 80;
    server_name $IP;
    location /.well-known/acme-challenge/ {
        root /var/www/acme;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}
EOF

ln -sfn "$SITE" "$ENABLED"

# Only one vhost can answer the bare IP on 443; the old VAS redirect would win
# on server_name and shadow this one.
rm -f "$VAS443_ENABLED"

if ! nginx -t; then
  echo "nginx rejected the new config; restoring the previous vhosts" >&2
  if [ -f "$BACKUP/communityhub-tls" ]; then cp -a "$BACKUP/communityhub-tls" "$SITE"; else rm -f "$SITE" "$ENABLED"; fi
  [ -f "$BACKUP/vas-ip-redirect.conf" ] && cp -a "$BACKUP/vas-ip-redirect.conf" "$VAS80"
  [ -f "$BACKUP/vas-ip-redirect-443.link" ] && ln -sfn /etc/nginx/sites-available/vas-ip-redirect-443.conf "$VAS443_ENABLED"
  nginx -t || true
  exit 1
fi
systemctl reload nginx
sleep 2

# nginx reloads keep the old config when a listen socket cannot be bound, so
# check the certificate actually being served rather than trusting the exit.
want="$(openssl x509 -in "$CERT" -noout -fingerprint -sha256 2>/dev/null || true)"
got="$(echo | openssl s_client -connect "127.0.0.1:443" 2>/dev/null |
  openssl x509 -noout -fingerprint -sha256 2>/dev/null || true)"
if [ -n "$want" ] && [ "$want" != "$got" ]; then
  echo "port 443 is not serving the hub certificate; another vhost owns the IP" >&2
  echo "check: nginx -T | grep -B2 -A2 'server_name $IP'" >&2
fi

# --- 4. The app is now behind TLS ------------------------------------------
if [ -f .env ]; then
  value() { sed -n "s|^$1=||p" .env | tail -n 1; }
  set_value() {
    if grep -q "^$1=" .env; then
      sed -i "s|^$1=.*|$1=$2|" .env
    else
      printf '%s=%s\n' "$1" "$2" >>.env
    fi
  }

  set_value CLIENT_ORIGIN "https://$IP"
  # Keep the :8443 alias usable in a browser: its Origin must still be trusted.
  case ",$(value CORS_EXTRA_ORIGINS)," in
    *":8443,"*) ;;
    *) set_value CORS_EXTRA_ORIGINS "https://$IP:$PORT" ;;
  esac
  set_value COOKIE_SECURE "true"
  set_value WEB_BIND "127.0.0.1"
  set_value BEHIND_TLS_PROXY "1"
  # The API now sits behind two proxies, so it has to look two hops back for
  # the member's address instead of putting everyone in one rate-limit bucket.
  set_value TRUST_PROXY "2"
  echo "• .env updated; the next roll-out (<= 2 min) recreates the web container on loopback"
else
  echo "• No .env in $(pwd); set CLIENT_ORIGIN=https://$IP and COOKIE_SECURE=true yourself" >&2
fi

# --- 5. Renew the short-lived certificate -----------------------------------
cat >/etc/cron.d/communityhub-ip-cert <<EOF
# Let's Encrypt IP certificates are only valid for ~6 days.
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 3,15 * * * root docker run --rm -v $CERTDIR:/etc/letsencrypt -v $WEBROOT:/var/www/acme $IMAGE renew --quiet && systemctl reload nginx
EOF
chmod 644 /etc/cron.d/communityhub-ip-cert

# --- 6. Smoke test ----------------------------------------------------------
for port in 443 "$PORT"; do
  code="$(curl -sSk --max-time 15 -o /dev/null -w '%{http_code}' "https://127.0.0.1:$port/api/categories" || true)"
  echo "  https://127.0.0.1:$port/api/categories -> ${code:-no response}"
done
echo
echo "Done: https://$IP/  (alias https://$IP:$PORT/)"
echo "Old http://$IP:8080 closes once the puller applies the new .env."
