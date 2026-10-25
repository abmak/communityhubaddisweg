#!/bin/sh
# HTTPS for the community hub on this server's public IP.
#
#   sudo sh ~/communityhub/https-setup.sh
#
# Ports 80 and 443 already belong to the host's nginx (other sites live
# there), so the compose Caddy can never bind them and this app has been on
# plain HTTP — where phones refuse to share their location. This script adds a
# TLS vhost on port 8443 in front of the web container:
#
#   https://<public-ip>:8443
#
# The certificate is a Let's Encrypt IP certificate. Let's Encrypt only issues
# those as six-day "shortlived" certificates, so a root cron entry renews it
# twice a day and reloads nginx. certbot needs 5.4+ for --ip-address with
# --webroot, hence the official image; it keeps its state in
# /etc/letsencrypt-ip so the system certbot (which manages the other sites)
# is left untouched.
#
# Safe to re-run: the vhost and cron entry are rewritten, and certbot reuses
# the existing certificate until it is due.
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
SITE=/etc/nginx/sites-available/communityhub-tls
ENABLED=/etc/nginx/sites-enabled/communityhub-tls
CERTDIR=/etc/letsencrypt-ip
IMAGE=certbot/certbot:latest

echo "• Certificate for $IP will be served on port $PORT"

# --- 1. Let the bare-IP port-80 block answer the ACME challenge -------------
# That block currently proxies /.well-known/acme-challenge/ to the VAS app on
# :5001, which cannot hand out our token. Everything else keeps its redirect.
install -d -m 755 "$WEBROOT/.well-known/acme-challenge"
if [ -f "$VAS80" ] && grep -q "proxy_pass http://127.0.0.1:5001;" "$VAS80"; then
  cp "$VAS80" "$VAS80.bak-communityhub-$(date +%Y%m%d%H%M%S)"
  sed -i '\#location /.well-known/acme-challenge/#,\#}# s|proxy_pass http://127.0.0.1:5001;|root /var/www/acme;|' "$VAS80"
  if ! grep -q "root /var/www/acme;" "$VAS80"; then
    echo "could not repoint the ACME challenge in $VAS80" >&2
    exit 1
  fi
  nginx -t
  systemctl reload nginx
  echo "  port 80 now serves ACME challenges from $WEBROOT"
else
  echo "  $VAS80 already serves ACME challenges from disk (or is absent)"
fi

# --- 2. Issue the IP certificate -------------------------------------------
echo "• Fetching certbot"
docker pull -q "$IMAGE" >/dev/null
CB="$(docker run --rm "$IMAGE" --version | awk '{print $2}')"
CB_MAJOR="${CB%%.*}"
CB_MINOR="${CB#*.}"
CB_MINOR="${CB_MINOR%%.*}"
if [ "$CB_MAJOR" -lt 5 ] || { [ "$CB_MAJOR" -eq 5 ] && [ "$CB_MINOR" -lt 4 ]; }; then
  echo "certbot 5.4+ is required for IP certificates, the image has $CB" >&2
  exit 1
fi
echo "  certbot $CB"

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

CERT="$CERTDIR/live/$IP/fullchain.pem"
KEY="$CERTDIR/live/$IP/privkey.pem"
[ -s "$CERT" ] && [ -s "$KEY" ] || { echo "certificate files are missing under $CERTDIR/live/$IP" >&2; exit 1; }

# --- 3. Terminate TLS on the host nginx and proxy to the app ----------------
echo "• Writing the nginx vhost"
cat > "$SITE" <<EOF
# Managed by communityhub https-setup.sh — re-runs rewrite this file.
# HTTPS entry point for the community hub on the host's public IP.
server {
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

ln -sfn "$SITE" "$ENABLED"
if ! nginx -t; then
  echo "nginx rejected the new vhost; removing it and leaving the app as it was" >&2
  rm -f "$ENABLED"
  exit 1
fi
systemctl reload nginx

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

  set_value CLIENT_ORIGIN "https://$IP:$PORT"
  set_value COOKIE_SECURE "true"
  set_value WEB_BIND "127.0.0.1"
  set_value BEHIND_TLS_PROXY "1"
  # The API now sits behind two proxies, so it has to look two hops back for
  # the member's address instead of putting everyone in one rate-limit bucket.
  set_value TRUST_PROXY "2"
  echo "• .env updated; the next roll-out (<= 2 min) recreates the web container on loopback"
else
  echo "• No .env in $(pwd); set CLIENT_ORIGIN=https://$IP:$PORT and COOKIE_SECURE=true yourself" >&2
fi

# --- 5. Renew the short-lived certificate -----------------------------------
cat > /etc/cron.d/communityhub-ip-cert <<EOF
# Let's Encrypt IP certificates are only valid for ~6 days.
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 3,15 * * * root docker run --rm -v $CERTDIR:/etc/letsencrypt -v $WEBROOT:/var/www/acme $IMAGE renew --quiet && systemctl reload nginx
EOF
chmod 644 /etc/cron.d/communityhub-ip-cert

# --- 6. Smoke test ----------------------------------------------------------
sleep 2
code="$(curl -sSk --max-time 15 -o /dev/null -w '%{http_code}' "https://127.0.0.1:$PORT/api/categories" || true)"
echo
echo "Done: https://$IP:$PORT/  (local API check: ${code:-no response})"
echo "Old http://$IP:8080 closes once the puller applies the new .env."
