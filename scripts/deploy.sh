#!/usr/bin/env bash
# Deploy Vitalych to a remote host over SSH.
# Usage: scripts/deploy.sh [user@]host
# Example: scripts/deploy.sh nineone@10.91.0.142
set -euo pipefail

REMOTE="${1:-nineone@10.91.0.142}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_DIR="${REMOTE_DIR:-}"

echo "==> Building frontend locally"
cd "$ROOT/web"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
npm run build

echo "==> Resolving remote install directory"
if [[ -z "$REMOTE_DIR" ]]; then
  if ssh "$REMOTE" 'sudo -n true' 2>/dev/null; then
    REMOTE_DIR=/opt/vitalych
  else
    REMOTE_DIR='$HOME/vitalych'
  fi
fi

REMOTE_ABS="$(ssh "$REMOTE" "echo ${REMOTE_DIR}")"
echo "    Using ${REMOTE}:${REMOTE_ABS}"

ssh "$REMOTE" "mkdir -p '${REMOTE_ABS}'"
# /opt path may need sudo ownership once
if [[ "$REMOTE_ABS" == /opt/* ]]; then
  ssh "$REMOTE" "sudo mkdir -p '${REMOTE_ABS}' && sudo chown \"\$(whoami)\" '${REMOTE_ABS}'" || true
fi

echo "==> Syncing to ${REMOTE}:${REMOTE_ABS}"
rsync -az --delete \
  --exclude '.git/' \
  --exclude '.venv/' \
  --exclude 'web/node_modules/' \
  --exclude 'out/' \
  --exclude '.DS_Store' \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude 'out/~$*' \
  "$ROOT/" "${REMOTE}:${REMOTE_ABS}/"

echo "==> Installing Python deps and starting service on remote"
ssh "$REMOTE" bash -s <<REMOTE_SCRIPT
set -euo pipefail
DIR='${REMOTE_ABS}'
cd "\$DIR"
UV="\$HOME/.local/bin/uv"
if [[ ! -x "\$UV" ]]; then
  UV="\$(command -v uv || true)"
fi
if [[ -z "\$UV" ]]; then
  echo "uv not found; install uv or set PATH" >&2
  exit 1
fi
# System python is 3.8; app needs 3.9+ (dict[str, ...] annotations).
"\$UV" venv --python 3.12 .venv
"\$UV" pip install --python .venv/bin/python -r requirements.txt

if command -v systemctl >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  UNIT=/tmp/vitalych.service
  sed "s|/opt/vitalych|\$DIR|g" deploy/vitalych.service > "\$UNIT"
  sudo cp "\$UNIT" /etc/systemd/system/vitalych.service
  sudo systemctl daemon-reload
  sudo systemctl enable vitalych.service
  sudo systemctl restart vitalych.service
  sleep 1
  sudo systemctl --no-pager --full status vitalych.service || true
else
  if command -v fuser >/dev/null 2>&1; then
    fuser -k 8080/tcp >/dev/null 2>&1 || true
  elif command -v lsof >/dev/null 2>&1; then
    pid=\$(lsof -t -iTCP:8080 -sTCP:LISTEN 2>/dev/null || true)
    if [[ -n "\${pid:-}" ]]; then
      kill \$pid 2>/dev/null || true
      sleep 1
    fi
  fi
  mkdir -p logs
  nohup .venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 8080 >logs/uvicorn.log 2>&1 &
  sleep 2
fi

if ! curl -sf "http://127.0.0.1:8080/api/health"; then
  echo
  echo "Health check failed; last log lines:" >&2
  tail -n 40 logs/uvicorn.log >&2 || true
  exit 1
fi
echo
REMOTE_SCRIPT

HOST_ONLY="${REMOTE##*@}"
echo "==> Done. Open http://${HOST_ONLY}:8080/"
