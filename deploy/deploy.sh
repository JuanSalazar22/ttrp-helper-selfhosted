#!/usr/bin/env bash
# Automated deploy: pulls the latest main and rebuilds the app's Docker
# containers, without ever touching ./data (accounts, passkeys, characters,
# portraits) or .env — both are gitignored, and ./data is a bind mount that
# lives outside the image, so a checkout + rebuild never rewrites either.
#
# Triggered by .github/workflows/deploy.yml over SSH, using a dedicated
# deploy-only key whose authorized_keys entry force-runs ONLY this script
# (see docs/SELF_HOSTING.md's "Automated deploys" section). Safe to also run
# by hand on the box: `./deploy/deploy.sh`.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$REPO_DIR/deploy/deploy.log"
BACKUP_DIR="$HOME/backups"
KEEP_BACKUPS=10
LOCK_FILE="/tmp/ttrp-deploy.lock"

log() { echo "$(date -Is) $*" | tee -a "$LOG_FILE"; }

# Prevent two deploys (e.g. two rapid merges) from racing each other.
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  log "another deploy is already running — skipping this one"
  exit 0
fi

cd "$REPO_DIR"
log "=== deploy check ==="

BEFORE="$(git rev-parse HEAD)"
git fetch origin main --quiet
AFTER="$(git rev-parse origin/main)"

if [ "$BEFORE" = "$AFTER" ]; then
  log "already up to date at $BEFORE — nothing to do"
  exit 0
fi

# Rotating snapshot of data + .env before pulling anything, belt-and-suspenders
# even though neither is ever touched by the steps below. `secret` (root-only,
# 600) is skipped when running as a non-root user — that's fine, it's never
# regenerated as long as ./data itself isn't deleted, which this script never does.
mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
tar --ignore-failed-read -czf "$BACKUP_DIR/ttrp-data-$TS.tar.gz" -C "$REPO_DIR" data .env 2>/dev/null || true
ls -t "$BACKUP_DIR"/ttrp-data-*.tar.gz 2>/dev/null | tail -n "+$((KEEP_BACKUPS + 1))" | xargs -r rm --

log "updating $BEFORE -> $AFTER"
git checkout main --quiet
git merge --ff-only origin/main --quiet

{
  docker compose up -d --build
  docker image prune -f
} >>"$LOG_FILE" 2>&1

log "=== deploy done — now at $(git rev-parse HEAD) ==="
