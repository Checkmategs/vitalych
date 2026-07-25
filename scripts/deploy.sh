#!/usr/bin/env bash
# Deploy Vitalych to a remote host over SSH.
# Usage: scripts/deploy.sh [user@]host
# Example: scripts/deploy.sh nineone@10.91.0.142
#
# One-time on the server (before first deploy or after wipe):
#   cp .env.example .env
#   # set a strong POSTGRES_PASSWORD and matching DATABASE_URL
# Do not commit real passwords. .env is rsync-excluded so the server copy is preserved.
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
# Live SoT is Postgres — do not exclude data/project.yaml or templates/*.j2.
# Preserve server .env (operator-created once from .env.example).
rsync -az --delete \
  --exclude '.git/' \
  --exclude '.venv/' \
  --exclude '.env' \
  --exclude 'web/node_modules/' \
  --exclude 'out/' \
  --exclude '.DS_Store' \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude 'out/~$*' \
  "$ROOT/" "${REMOTE}:${REMOTE_ABS}/"

echo "==> Installing deps, Postgres, migrations, and starting service on remote"
ssh "$REMOTE" bash -s <<REMOTE_SCRIPT
set -euo pipefail
DIR='${REMOTE_ABS}'
cd "\$DIR"

if [[ ! -f .env ]]; then
  echo "Missing \$DIR/.env on server." >&2
  echo "One-time setup: cp .env.example .env  then set a strong POSTGRES_PASSWORD" >&2
  echo "and matching DATABASE_URL (do not commit real passwords)." >&2
  exit 1
fi

# Export DATABASE_URL (and related) for alembic + seed in this shell.
set -a
# shellcheck disable=SC1091
. ./.env
set +a

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found on remote; install Docker Engine + Compose plugin" >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose not available; install the Compose plugin" >&2
  exit 1
fi

echo "==> Starting Postgres (docker compose)"
docker compose up -d
# Wait until Postgres accepts connections
for i in \$(seq 1 30); do
  if docker compose exec -T db pg_isready -U "\${POSTGRES_USER:-vitalych}" -d "\${POSTGRES_DB:-vitalych}" >/dev/null 2>&1; then
    break
  fi
  if [[ \$i -eq 30 ]]; then
    echo "Postgres did not become ready in time" >&2
    docker compose ps >&2 || true
    exit 1
  fi
  sleep 1
done

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

echo "==> alembic upgrade head"
.venv/bin/alembic upgrade head

echo "==> seed_from_files (no-op if projects exist)"
.venv/bin/python scripts/seed_from_files.py

if command -v systemctl >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  UNIT=/tmp/vitalych.service
  sed "s|/opt/vitalych|\$DIR|g" deploy/vitalych.service > "\$UNIT"
  sudo cp "\$UNIT" /etc/systemd/system/vitalych.service
  sudo systemctl daemon-reload
  sudo systemctl enable vitalych.service
  sudo systemctl restart vitalych.service
  sleep 1
  sudo systemctl --no-pager --full status vitalych.service || true
elif command -v systemctl >/dev/null 2>&1; then
  # No passwordless sudo: user systemd unit (survives closing SSH/terminal).
  # Unit paths use %h/vitalych — matches default REMOTE_ABS=\$HOME/vitalych.
  export XDG_RUNTIME_DIR="\${XDG_RUNTIME_DIR:-/run/user/\$(id -u)}"
  mkdir -p "\$HOME/.config/systemd/user"
  if [[ -f deploy/vitalych.user.service ]]; then
    cp deploy/vitalych.user.service "\$HOME/.config/systemd/user/vitalych.service"
  else
    sed "s|/opt/vitalych|\$DIR|g; s|WantedBy=multi-user.target|WantedBy=default.target|" \
      deploy/vitalych.service > "\$HOME/.config/systemd/user/vitalych.service"
    # Fix WorkingDirectory/ExecStart to absolute DIR if unit still points elsewhere
    sed -i "s|WorkingDirectory=.*|WorkingDirectory=\$DIR|; s|ExecStart=.*/uvicorn|ExecStart=\$DIR/.venv/bin/uvicorn|" \
      "\$HOME/.config/systemd/user/vitalych.service" || true
  fi
  # Free port from any previous nohup instance
  if command -v fuser >/dev/null 2>&1; then
    fuser -k 8080/tcp >/dev/null 2>&1 || true
  elif command -v lsof >/dev/null 2>&1; then
    pid=\$(lsof -t -iTCP:8080 -sTCP:LISTEN 2>/dev/null || true)
    if [[ -n "\${pid:-}" ]]; then
      kill \$pid 2>/dev/null || true
      sleep 1
    fi
  fi
  systemctl --user daemon-reload
  systemctl --user enable vitalych.service
  systemctl --user restart vitalych.service
  # Persist across logout/reboot when allowed (needs root once)
  loginctl enable-linger "\$(whoami)" 2>/dev/null || true
  sleep 1
  systemctl --user --no-pager --full status vitalych.service || true
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
