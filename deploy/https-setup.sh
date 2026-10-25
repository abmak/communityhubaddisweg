#!/bin/sh
# One-time HTTPS for the community hub, using the host's own nginx and the
# Let's Encrypt certificate already managed by certbot on this machine.
#
# Run on the VPS as root, with a hostname whose DNS points at the server:
#
#   sudo sh https-setup.sh addisweg.jobsethiopia.et
#
# Ports 80 and 443 are owned by the host's nginx (another site runs there), so
# this adds a virtual host instead of starting the compose Caddy: port 80
# answers the ACME challenge and redirects to HTTPS, port 443 terminates TLS
# and proxies to the web container on 127.0.0.1:8080.
#
# It is safe to re-run: the vhost is rewritten, certbot reuses the existing
# certificate, and the .env edits are idempotent.
set -eu

NAME="${1:-}"
if [ -z "$NAME" ]; then
  echo "usage: sudo sh https-setup.sh <hostname>   e.g. addisweg.jobsethiopia.et" >&2
  exit 1
fi
if [ "$(id -u)" -ne 0 ]; then
  echo "run this with root privileges:  sudo sh $0 $NAME" >&2
  exit 1
fi

cd "$(dirname "$0")"
WEBROOT=/var/www/acme
SITE=/etc/nginx/sites-available/communityhub
ENABLED=/etc/nginx/sites-enabled/communityhub

# --- 1. Does the name actually point here? ---------------------------------
resolved="$(getent hosts "$NAME" | awk '{print $1; exit}' || true)"
public="$(curl -fsS --max-time 10 https://api.ipify.org || true)"
if [ -z "$resolved" ]; then
  echo "DNS: $NAME does not resolve yet. Add an A record first." >&2
  exit 1
fi
if [ -n "$public" ] && [ "$resolved" != "$public" ]; then
  echo "Warning: $NAME resolves to $resolved, but this host answers as $public." >&2
fi

# --- 2. Serve the ACME challenge on port 80 --------------------------------
mkdir -p "$WEBROOT/.well-known/acme-challenge"
cat > "$SITE" <<EOF
server {
    listen 80;
    server_name $NAME;

    location /.well-known/acme-challenge/ {
        root $WEBROOT;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}
EOF
ln -sfn "$SITE" "$ENABLED"
nginx -t
systemctl reload nginx

# --- 3. Certificate (renewals are automatic via the certbot timer) ----------
certbot certonly --webroot -w "$WEBROOT" -d "$NAME" \
  --non-interactive --agree-tos --register-unsafely-without-email \
  --deploy-hook "systemctl reload nginx"

# --- 4. Terminate TLS here and proxy to the app ----------------------------
cat > "$SITE" <<EOF
# Managed by communityhub https-setup.sh — re-runs rewrite this file.
server {
    listen 80;
    server_name $NAME;

    location /.well-known/acme-challenge/ {
        root $WEBROOT;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name $NAME;

    ssl_certificate     /etc/letsencrypt/live/$NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$NAME/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    client_max_body_size 30m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        # Socket.IO upgrades and long-lived polling.
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 600s;
    }
}
EOF

nginx -t
systemctl reload nginx

# --- 5. Let the app know it is behind TLS ----------------------------------
value() { sed -n "s|^$1=||p" .env | tail -n 1; }
set_value() {
  if grep -q "^$1=" .env; then
    sed -i "s|^$1=.*|$1=$2|" .env
  else
    printf '%s=%s\n' "$1" "$2" >>.env
  fi
}

if [ ! -f .env ]; then
  echo "No .env in $(pwd); skipping the app settings. Set CLIENT_ORIGIN=https://$NAME" >&2
else
  set_value CLIENT_ORIGIN "https://$NAME"
  set_value COOKIE_SECURE "true"
  set_value WEB_BIND "127.0.0.1"
  set_value BEHIND_TLS_PROXY "1"
  echo "App settings updated; the next roll-out (<= 2 min) recreates the web container."
fi

# The puller must stop forcing the plain-HTTP settings from now on.
PULLER="$(pwd)/update.sh"
if [ -f "$PULLER" ] && ! grep -q "BEHIND_TLS_PROXY" "$PULLER"; then
  curl -fsS --max-time 30 \
    https://raw.githubusercontent.com/abmak/communityhubaddisweg/main/deploy/update.sh \
    -o "$PULLER.new" && mv "$PULLER.new" "$PULLER" && chmod +x "$PULLER"
fi

echo
echo "Done: https://$NAME/"
echo "The API and websocket traffic follow the same origin."
