#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COVER_DIR="$ROOT_DIR/public/images/designers/projects/covers"
DETAIL_DIR="$ROOT_DIR/public/images/designers/projects/details"

mkdir -p "$DETAIL_DIR"

for cover in "$COVER_DIR"/cover-*.jpg; do
  filename="$(basename "$cover" .jpg)"
  tmp1="$DETAIL_DIR/${filename}-tmp-2.jpg"
  tmp2="$DETAIL_DIR/${filename}-tmp-3.jpg"

  cp "$cover" "$DETAIL_DIR/${filename}-1.jpg"

  sips -c 820 1080 --cropOffset 20 40 "$cover" --out "$tmp1" >/dev/null
  sips -z 900 1200 "$tmp1" --out "$DETAIL_DIR/${filename}-2.jpg" >/dev/null

  sips -c 820 1080 --cropOffset 60 80 "$cover" --out "$tmp2" >/dev/null
  sips -z 900 1200 "$tmp2" --out "$DETAIL_DIR/${filename}-3.jpg" >/dev/null

  rm -f "$tmp1" "$tmp2"
done

echo "Generated 225 unique project detail files in $DETAIL_DIR"
