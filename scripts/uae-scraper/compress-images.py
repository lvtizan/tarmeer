#!/usr/bin/env python3
"""
Compress portfolio images to web-friendly thumbnails.
- Target: max 800px wide, quality 75, JPEG format
- Keeps originals if already small enough
- Skips SVG files

Usage:
  python3 scripts/uae-scraper/compress-images.py                # dry-run
  python3 scripts/uae-scraper/compress-images.py --apply         # compress in-place
  python3 scripts/uae-scraper/compress-images.py --apply --max-width 600
"""

import os
import sys
import argparse
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("PIL not found. Install: pip3 install Pillow")
    sys.exit(1)

PORTFOLIO_DIR = Path(__file__).parent.parent.parent / "public" / "images" / "uae-companies" / "portfolio"
MAX_WIDTH = 1600
MAX_HEIGHT = 1600
QUALITY = 85
MIN_SIZE_KB = 50  # don't touch files already under 50KB
IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}


def compress_image(filepath, max_width, max_height, quality, dry_run=True):
    """Compress a single image. Returns (original_size, new_size) or None if skipped."""
    original_size = filepath.stat().st_size

    # Skip small files
    if original_size < MIN_SIZE_KB * 1024:
        return None

    try:
        img = Image.open(filepath)
    except Exception:
        return None

    w, h = img.size

    # Skip if already small enough
    if w <= max_width and h <= max_height and original_size < 150 * 1024:
        return None

    # Calculate new dimensions maintaining aspect ratio
    ratio = min(max_width / w, max_height / h)
    if ratio >= 1.0:
        # Image is already within bounds, just recompress if large
        if original_size < 150 * 1024:
            return None
        new_w, new_h = w, h
    else:
        new_w = int(w * ratio)
        new_h = int(h * ratio)

    if dry_run:
        estimated = int(original_size * ratio * 0.5)  # rough estimate
        return (original_size, estimated)

    # Resize and save
    try:
        img = img.convert('RGB')
        if ratio < 1.0:
            img = img.resize((new_w, new_h), Image.LANCZOS)

        # Save as JPEG (best compression for photos)
        out_path = filepath.with_suffix('.jpg') if filepath.suffix != '.jpg' else filepath
        img.save(out_path, 'JPEG', quality=quality, optimize=True)

        # If we changed extension, remove original
        if out_path != filepath and out_path.exists():
            filepath.unlink()

        new_size = out_path.stat().st_size
        return (original_size, new_size)
    except Exception as e:
        print(f"  Error: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description='Compress portfolio images')
    parser.add_argument('--apply', action='store_true', help='Actually compress (default: dry-run)')
    parser.add_argument('--max-width', type=int, default=MAX_WIDTH, help=f'Max width in pixels (default: {MAX_WIDTH})')
    parser.add_argument('--max-height', type=int, default=MAX_HEIGHT, help=f'Max height in pixels (default: {MAX_HEIGHT})')
    parser.add_argument('--quality', type=int, default=QUALITY, help=f'JPEG quality (default: {QUALITY})')
    parser.add_argument('--slug', type=str, default=None, help='Process single company')
    args = parser.parse_args()

    dry_run = not args.apply
    print(f"=== Image Compression {'(DRY RUN)' if dry_run else '(APPLYING)'} ===")
    print(f"Max: {args.max_width}x{args.max_height}, Quality: {args.quality}")
    print()

    total_original = 0
    total_new = 0
    compressed_count = 0
    skipped_count = 0

    if args.slug:
        company_dirs = [PORTFOLIO_DIR / args.slug]
    else:
        company_dirs = sorted([d for d in PORTFOLIO_DIR.iterdir() if d.is_dir()])

    for company_dir in company_dirs:
        if not company_dir.exists():
            continue

        company_original = 0
        company_new = 0
        company_compressed = 0

        for root, dirs, files in os.walk(company_dir):
            for fname in files:
                fpath = Path(root) / fname
                if fpath.suffix.lower() not in IMAGE_EXTS:
                    continue

                result = compress_image(fpath, args.max_width, args.max_height, args.quality, dry_run)
                if result is None:
                    skipped_count += 1
                    continue

                orig, new = result
                company_original += orig
                company_new += new
                company_compressed += 1
                compressed_count += 1

        if company_compressed > 0:
            saved = company_original - company_new
            pct = (saved / company_original * 100) if company_original > 0 else 0
            print(f"{company_dir.name}: {company_compressed} files, "
                  f"{company_original // 1024}KB -> {company_new // 1024}KB "
                  f"(saved {saved // 1024}KB, {pct:.0f}%)")
            total_original += company_original
            total_new += company_new

    print()
    print(f"=== Summary ===")
    print(f"Compressed: {compressed_count} files")
    print(f"Skipped: {skipped_count} files (already small)")
    if total_original > 0:
        saved = total_original - total_new
        print(f"Total: {total_original // (1024*1024)}MB -> {total_new // (1024*1024)}MB "
              f"(saved {saved // (1024*1024)}MB, {saved / total_original * 100:.0f}%)")
    if dry_run:
        print("\nDry run. Use --apply to compress.")


if __name__ == '__main__':
    main()
