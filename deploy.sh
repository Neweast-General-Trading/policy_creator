#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
DEPLOY="/var/www/policycreator.neweast.cloud"
INTRANET_NGINX="/etc/nginx/sites-available/intranet.neweast.cloud"
POLICY_NGINX="/etc/nginx/sites-available/policycreator.neweast.cloud"
MIS_NGINX="/etc/nginx/sites-available/mis.neweast.cloud"

echo "Building Policy Creator API…"
cd "$ROOT/server"
npm install
npm run build

echo "Building Policy Creator client…"
cd "$ROOT"
npm install
npm run build

echo "Deploying client to ${DEPLOY}…"
mkdir -p "$DEPLOY"
rsync -a --delete dist/ "$DEPLOY/"

if ! sudo grep -q "policy-creator-viewer" "$INTRANET_NGINX"; then
  sudo sed -i '/location \/ {/i \    # policy-creator-viewer\n    include '"$ROOT"'/nginx/intranet-viewer.conf;' "$INTRANET_NGINX"
fi

if ! sudo grep -q "policy-creator-viewer-redirect" "$POLICY_NGINX"; then
  sudo sed -i '/location \/api\/ {/i \    # policy-creator-viewer-redirect\n    include '"$ROOT"'/nginx/policycreator-viewer-redirect.conf;' "$POLICY_NGINX"
fi

if sudo grep -q "policy-creator-viewer-mis" "$MIS_NGINX"; then
  sudo sed -i '/policy-creator-viewer-mis/,+1d' "$MIS_NGINX"
fi

if ! sudo grep -q "policy-creator-viewer-mis-redirect" "$MIS_NGINX"; then
  sudo sed -i '/location \/ {/i \    # policy-creator-viewer-mis-redirect\n    include '"$ROOT"'/nginx/mis-policy-redirect.conf;' "$MIS_NGINX"
fi

echo "Reloading nginx…"
sudo nginx -t && sudo systemctl reload nginx

echo "Restarting PM2 service…"
pm2 restart policy-creator-api --update-env 2>/dev/null || pm2 start "$ROOT/server/dist/index.js" --name policy-creator-api --cwd "$ROOT/server"

echo "Done → https://policycreator.neweast.cloud/viewer"
