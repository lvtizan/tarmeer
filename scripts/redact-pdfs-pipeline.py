#!/usr/bin/env python3
"""
通用 PDF 联系方式打白处理管线。

接受 stdin JSON 列表（每条 {id, file_url, local_path}），针对每个文件：
  1. 如果 file_url 是本地路径或带 /uploads/ 的 url 且 --uploads-root 指向有效目录 → 就地读
  2. 如果是 http(s) → 下载到 --tmp-dir
  3. PyMuPDF 检测电话/邮箱/微信/QQ/WhatsApp/中文地址，白块覆盖
  4. 输出到 --out-dir/<id>.pdf 或就地覆盖（--in-place）
  5. 把每条结果以 JSON Lines 输出到 stdout

用法：
    cat tasks.json | python3 redact-pdfs-pipeline.py \
        --uploads-root /path/to/uploads \
        --out-dir /tmp/redacted \
        --tmp-dir /tmp/dl \
        --dry-run

    # apply：直接覆盖 uploads-root 下的本地文件
    cat tasks.json | python3 redact-pdfs-pipeline.py \
        --uploads-root /path/to/uploads \
        --out-dir /path/to/uploads/catalogs/redacted \
        --tmp-dir /tmp/dl \
        --in-place \
        --backup-dir /path/to/uploads/catalogs/_backup/2026-05-05

依赖：pymupdf
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import urllib.request
from pathlib import Path
from typing import NamedTuple

try:
    import fitz
except ImportError:
    print("ERROR: pip install pymupdf", file=sys.stderr)
    sys.exit(2)


PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("CN_MOBILE",   re.compile(r"(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)")),
    ("CN_LANDLINE", re.compile(r"(?<!\d)(?:\+?86[-\s]?)?0\d{2,3}[-\s]?\d{7,8}(?!\d)")),
    ("UAE_MOBILE",  re.compile(r"(?<!\d)\+?971[-\s]?5\d[-\s]?\d{7}(?!\d)")),
    ("INTL_PHONE",  re.compile(r"(?<![\w\d])\+\d{1,3}[-\s]?\d{2,4}[-\s]?\d{4,8}(?:[-\s]?\d{2,6})?(?!\d)")),
    ("EMAIL",       re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")),
    ("WECHAT",      re.compile(r"(?:微\s*信(?:\s*号)?|WeChat|WX)\s*[:：]?\s*[A-Za-z0-9_\-]{4,32}")),
    ("WHATSAPP",    re.compile(r"WhatsApp\s*[:：]?\s*\+?\d[\d\s\-]{6,}")),
    ("QQ",          re.compile(r"\bQQ\s*[:：]?\s*\d{5,12}\b")),
    ("CN_ADDRESS",  re.compile(r"(?:地\s*址|公司地址)\s*[:：]?\s*\S[\S ]{4,80}")),
]


class Hit(NamedTuple):
    page: int
    bbox: tuple[float, float, float, float]
    label: str


def find_hits(page: fitz.Page) -> list[Hit]:
    out: list[Hit] = []
    for block in page.get_text("dict").get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text = (span.get("text") or "").strip()
                if not text:
                    continue
                for label, pat in PATTERNS:
                    if pat.search(text):
                        bbox = span.get("bbox")
                        if bbox and len(bbox) == 4:
                            out.append(Hit(page.number, tuple(bbox), label))
                        break
    return out


def redact(src: Path, dst: Path, dry_run: bool) -> dict[str, int]:
    doc = fitz.open(str(src))
    counts: dict[str, int] = {}
    for page in doc:
        hits = find_hits(page)
        for h in hits:
            counts[h.label] = counts.get(h.label, 0) + 1
            if not dry_run:
                page.add_redact_annot(h.bbox, fill=(1, 1, 1))
        if not dry_run and hits:
            page.apply_redactions()
    if not dry_run:
        dst.parent.mkdir(parents=True, exist_ok=True)
        doc.save(str(dst), garbage=4, deflate=True, clean=True)
    doc.close()
    return counts


def resolve_local(file_url: str, uploads_root: Path | None) -> Path | None:
    if not file_url:
        return None
    if file_url.startswith("/") and not file_url.startswith("//"):
        # absolute filesystem path
        if Path(file_url).exists():
            return Path(file_url)
    if "/uploads/" in file_url and uploads_root:
        rel = file_url.split("/uploads/", 1)[1]
        cand = uploads_root / rel
        if cand.exists():
            return cand
    return None


def download(url: str, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r, open(dst, "wb") as f:
        shutil.copyfileobj(r, f)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--uploads-root", type=Path, default=None,
                    help="对 /uploads/* 形式的 url 解析到本地的根目录")
    ap.add_argument("--out-dir", type=Path, required=True,
                    help="输出目录（每个文件 <id>.pdf）")
    ap.add_argument("--tmp-dir", type=Path, default=Path("/tmp/redact-dl"),
                    help="外链下载暂存目录")
    ap.add_argument("--in-place", action="store_true",
                    help="本地文件覆盖原位置（先备份到 --backup-dir）")
    ap.add_argument("--backup-dir", type=Path, default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if args.in_place and not args.backup_dir:
        print("--in-place 必须搭配 --backup-dir", file=sys.stderr)
        return 2

    args.out_dir.mkdir(parents=True, exist_ok=True)
    args.tmp_dir.mkdir(parents=True, exist_ok=True)
    if args.backup_dir:
        args.backup_dir.mkdir(parents=True, exist_ok=True)

    tasks = json.load(sys.stdin)

    for t in tasks:
        item_id  = t.get("id")
        file_url = t.get("file_url") or ""
        result = {"id": item_id, "file_url": file_url, "status": "pending"}

        try:
            local = resolve_local(file_url, args.uploads_root)
            if local:
                src = local
                result["mode"] = "local"
                if args.in_place and not args.dry_run:
                    rel = local.relative_to(args.uploads_root) if args.uploads_root else Path(local.name)
                    bk = args.backup_dir / rel
                    bk.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(local, bk)
                    result["backup"] = str(bk)
                dst = local if args.in_place else args.out_dir / f"{item_id}.pdf"
            elif file_url.startswith(("http://", "https://")):
                src = args.tmp_dir / f"{item_id}.pdf"
                if not src.exists():
                    download(file_url, src)
                result["mode"] = "remote"
                result["downloaded_to"] = str(src)
                dst = args.out_dir / f"{item_id}.pdf"
            else:
                raise ValueError(f"can't resolve file_url: {file_url!r}")

            counts = redact(src, dst, args.dry_run)
            result["hits"] = counts
            result["dst"] = str(dst)
            result["status"] = "ok"
        except Exception as e:
            result["status"] = "failed"
            result["error"] = repr(e)

        sys.stdout.write(json.dumps(result, ensure_ascii=False) + "\n")
        sys.stdout.flush()

    return 0


if __name__ == "__main__":
    sys.exit(main())
