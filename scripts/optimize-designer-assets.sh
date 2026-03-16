#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DESIGNER_DIR="$ROOT_DIR/public/images/designers"
PROJECTS_DIR="$DESIGNER_DIR/projects"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

rewrite_jpeg() {
  local source_file="$1"
  local max_edge="$2"
  local quality="$3"
  local temp_file="$TMP_DIR/$(basename "$source_file")"

  sips -Z "$max_edge" -s format jpeg -s formatOptions "$quality" "$source_file" --out "$temp_file" >/dev/null
  mv "$temp_file" "$source_file"
}

echo "Removing unused legacy designer project assets..."
rm -rf "$PROJECTS_DIR/details"
find "$PROJECTS_DIR" -maxdepth 1 -type f \( -name '*.jpg' -o -name '*.svg' \) -delete

echo "Optimizing active designer project covers..."
find "$PROJECTS_DIR/covers" -type f -name '*.jpg' | while read -r file; do
  rewrite_jpeg "$file" 960 72
done

echo "Optimizing active designer project detail images..."
find "$PROJECTS_DIR/details-v2" -type f -name '*.jpg' | while read -r file; do
  rewrite_jpeg "$file" 960 72
done

echo "Designer assets optimization complete."
