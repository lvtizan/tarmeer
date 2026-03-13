#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/tmp-project-sources"
OUTPUT_DIR="$ROOT_DIR/public/images/designers/projects/covers"

mkdir -p "$SOURCE_DIR" "$OUTPUT_DIR"

IDS=(
  15242038 5353892 8753786 34538286 32025946
  30705322 34675226 34538290 34538295 32025920
  35896200 7166942 7601156 35018333 29923543
  10827348 31606505 32025945 4119847 7939863
  16968141 7027978 20285350 17240682 20390760
)

index=1
for id in "${IDS[@]}"; do
  source_file="$SOURCE_DIR/source-${index}.jpg"
  curl -fL "https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1800" -o "$source_file"

  resized="$SOURCE_DIR/source-${index}-resized.jpg"
  sips -Z 1800 "$source_file" --out "$resized" >/dev/null

  base=$(( (index - 1) * 3 + 1 ))
  sips -c 900 1200 --cropOffset 0 0 "$resized" --out "$OUTPUT_DIR/cover-$(printf '%03d' "$base").jpg" >/dev/null
  sips -c 900 1200 --cropOffset 80 120 "$resized" --out "$OUTPUT_DIR/cover-$(printf '%03d' "$((base + 1))").jpg" >/dev/null
  sips -c 900 1200 --cropOffset 160 240 "$resized" --out "$OUTPUT_DIR/cover-$(printf '%03d' "$((base + 2))").jpg" >/dev/null

  index=$((index + 1))
done

echo "Generated 75 unique project cover files in $OUTPUT_DIR"
