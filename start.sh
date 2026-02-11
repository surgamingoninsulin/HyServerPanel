#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT_DIR/.run"
mkdir -p "$RUN_DIR"

start_service() {
  local name="$1"
  local pid_file="$2"
  local log_file="$3"
  shift 3

  if [[ -f "$pid_file" ]]; then
    local existing_pid
    existing_pid="$(cat "$pid_file")"
    if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" 2>/dev/null; then
      echo "$name is already running (PID $existing_pid)."
      return 0
    fi
    rm -f "$pid_file"
  fi

  (
    cd "$ROOT_DIR/$name"
    "$@" >"$log_file" 2>&1
  ) &
  local new_pid=$!
  echo "$new_pid" >"$pid_file"
  echo "Started $name (PID $new_pid). Logs: $log_file"
}

start_service "backend" "$RUN_DIR/backend.pid" "$RUN_DIR/backend.log" env \
  WARDEN_ENABLED="${WARDEN_ENABLED:-false}" \
  MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/modtale}" \
  R2_BUCKET_NAME="${R2_BUCKET_NAME:-modtale-local}" \
  R2_ACCESS_KEY="${R2_ACCESS_KEY:-local-dev-key}" \
  R2_SECRET_KEY="${R2_SECRET_KEY:-local-dev-secret}" \
  R2_ENDPOINT="${R2_ENDPOINT:-https://example.com}" \
  R2_PUBLIC_DOMAIN="${R2_PUBLIC_DOMAIN:-https://example.com}" \
  ./gradlew bootRun
start_service "frontend" "$RUN_DIR/frontend.pid" "$RUN_DIR/frontend.log" env \
  PUBLIC_API_URL="${PUBLIC_API_URL:-http://localhost:8080/api/v1}" \
  npm run dev

echo "All services started."
