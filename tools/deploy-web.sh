#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing environment file: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ -z "${WEB_DEPLOY_PATH:-}" ]]; then
  echo "WEB_DEPLOY_PATH must be set in $ENV_FILE" >&2
  exit 1
fi

deploy_app() {
  local app_name="$1"
  local deploy_name="$2"
  local base_path="/$deploy_name"
  local source_dir="$ROOT_DIR/apps/$app_name/dist"
  local target_dir="$WEB_DEPLOY_PATH/$deploy_name"

  npm run build "$app_name" -- "--base=$base_path"

  rm -rf "$target_dir"
  mkdir -p "$target_dir"
  cp -a "$source_dir/." "$target_dir/"

  echo "Deployed $app_name to $target_dir"
}

deploy_app "postral-landing" "postral"
deploy_app "xdraw" "xdraw"