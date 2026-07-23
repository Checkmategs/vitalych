#!/usr/bin/env bash
# Deploy Vitalych to a remote host over SSH.
# Usage: scripts/deploy.sh [user@]host
# Example: scripts/deploy.sh root@10.91.0.142
set -euo pipefail

REMOTE="${1:-}"
if [[ -z "$REMOTE" ]]; then
  echo "Usage: $0 [user@]host" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_DIR="${REMOTE_DIR:-/opt/vitalych}"

echo "==> Building frontend locally"
cd "$ROOT/web"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
npm run build

echo "==> Syncing to ${REMOTE}:${REMOTE_DIR}"
ssh "$REMOTE" "sudo mkdir -p '${REMOTE_DIR}' && sudo chown \"\$(whoami)\" '${REMOTE_DIR}'"

rsync -az --delete \
  --exclude '.git/' \
  --exclude '.venv/' \
  --exclude 'web/node_modules/' \
  --exclude 'out/' \
  --exclude '.DS_Store' \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude 'out/~$*' \
  "$ROOT/" "${REMOTE}:${REMOTE_DIR}/"

echo "==> Installing Python deps and systemd unit on remote"
ssh "$REMOTE" bash -s <<EOF
set -euo pipefail
cd '${REMOTE_DIR}'
python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt
sudo cp deploy/vitalych.service /etc/systemd/system/vitalych.service
sudo systemctl daemon-reload
sudo systemctl enable vitalych.service
sudo systemctl restart vitalych.service
sleep 1
sudo systemctl --no-pager --full status vitalych.service || true
curl -sf "http://127.0.0.1:8080/api/health" && echo
EOF

HOST_ONLY="${REMOTE##*@}"
echo "==> Done. Open http://${HOST_ONLY}:8080/"
