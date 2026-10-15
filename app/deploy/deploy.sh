#!/usr/bin/env bash
# Build the React app and deploy everything to the EC2 host.
#
# Usage:
#   EC2_HOST=ec2-user@1.2.3.4 ./deploy/deploy.sh
#
# Optional env vars:
#   REMOTE_DIR  (default: /home/ec2-user/rce-directory)
#   SSH_KEY     (path to identity file; passed as -i)

set -euo pipefail

cd "$(dirname "$0")/.."

: "${EC2_HOST:?set EC2_HOST=ec2-user@<public-ip-or-dns>}"
REMOTE_DIR="${REMOTE_DIR:-/home/ec2-user/rce-directory}"

SSH_OPTS=()
RSYNC_SSH="ssh"
if [[ -n "${SSH_KEY:-}" ]]; then
  SSH_OPTS+=("-i" "$SSH_KEY")
  RSYNC_SSH="ssh -i $SSH_KEY"
fi

echo "==> Building React app"
npm run build

echo "==> Ensuring remote directory exists"
ssh "${SSH_OPTS[@]}" "$EC2_HOST" "mkdir -p $REMOTE_DIR/web $REMOTE_DIR/igs"

echo "==> Syncing static build to $EC2_HOST:$REMOTE_DIR/web/"
rsync -avz --delete -e "$RSYNC_SSH" \
  dist/ "$EC2_HOST:$REMOTE_DIR/web/"

echo "==> Syncing compose files"
rsync -avz -e "$RSYNC_SSH" \
  deploy/docker-compose.yml \
  "$EC2_HOST:$REMOTE_DIR/"

echo "==> Syncing IG packages (loaded by HAPI for \$validate)"
rsync -avz -e "$RSYNC_SSH" \
  ../sandbox/rce.tgz ../sandbox/sphd.tgz \
  "$EC2_HOST:$REMOTE_DIR/igs/"

# deploy/Caddyfile is the committed template (placeholder domain and hash).
# The live config is deploy/Caddyfile.local (gitignored); push that one.
if [[ ! -f deploy/Caddyfile.local ]]; then
  echo "ERROR: deploy/Caddyfile.local not found. Refusing to push the template Caddyfile." >&2
  exit 1
fi
rsync -avz -e "$RSYNC_SSH" \
  deploy/Caddyfile.local "$EC2_HOST:$REMOTE_DIR/Caddyfile"

# Only push .env the first time; protect it after that.
if ! ssh "${SSH_OPTS[@]}" "$EC2_HOST" "test -f $REMOTE_DIR/.env"; then
  if [[ -f deploy/.env ]]; then
    echo "==> Pushing initial .env (one-time)"
    rsync -avz -e "$RSYNC_SSH" deploy/.env "$EC2_HOST:$REMOTE_DIR/.env"
  else
    echo "WARNING: no deploy/.env locally and none on the host."
    echo "         Create deploy/.env from .env.example and re-run, or scp it manually."
  fi
fi

echo "==> Restarting the stack"
ssh "${SSH_OPTS[@]}" "$EC2_HOST" \
  "cd $REMOTE_DIR && docker compose pull && docker compose up -d"

echo "==> Done."
echo "    http://${EC2_HOST#*@}/         (React app)"
echo "    http://${EC2_HOST#*@}/fhir/metadata  (HAPI — will prompt for basic auth)"
