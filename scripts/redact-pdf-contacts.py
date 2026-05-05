#!/usr/bin/env python3
"""
PDF 联系方式打白脚本 —— 用 PyMuPDF 把文本型 PDF 里的电话/邮箱/微信号/QQ 等用白色块覆盖。

适用场景：中国供应商上传的产品目录 PDF，希望屏蔽他们的联系方式后再上线。

用法：
    # 单文件
    python3 scripts/redact-pdf-contacts.py input.pdf -o output.pdf

    # 批量目录（递归找 *.pdf，输出到 redacted/ 子目录）
    python3 scripts/redact-pdf-contacts.py /path/to/catalogs/ --batch

    # 干跑（只列出会打白的项，不写文件）
    python3 scripts/redact-pdf-contacts.py input.pdf --dry-run

依赖：pip install pymupdf

局限：
  - 只处理文本型 PDF。如果是扫描图片 PDF，需要补 OCR（pytesseract + Pillow）
  - 不识别 QR 码（如要遮二维码需补 pyzbar 或 OpenCV QRCodeDetector）
  - WeChat / 商务 ID 这类文本型可被识别；图片式 logo 上印着的不会
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Iterable, NamedTuple

try:
    import fitz  # PyMuPDF
except ImportError:
    print("ERROR: 缺 pymupdf，请 `pip install pymupdf`", file=sys.stderr)
    sys.exit(1)


# ─── Detection patterns ──────────────────────────────────────────────
# 每个模式独立一条，便于后期增删。匹配中英 + 国际格式
PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("CN_MOBILE",   re.compile(r"(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)")),
    ("CN_LANDLINE", re.compile(r"(?<!\d)(?:\+?86[-\s]?)?0\d{2,3}[-\s]?\d{7,8}(?!\d)")),
    ("UAE_MOBILE",  re.compile(r"(?<!\d)\+?971[-\s]?5\d[-\s]?\d{7}(?!\d)")),
    ("INTL_PHONE",  re.compile(r"(?<![\w\d])\+\d{1,3}[-\s]?\d{2,4}[-\s]?\d{4,8}(?:[-\s]?\d{2,6})?(?!\d)")),
    ("EMAIL",       re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")),
    ("WECHAT",      re.compile(r"(?:微\s*信(?:\s*号)?|WeChat|WX)\s*[:：]?\s*[A-Za-z0-9_\-]{4,32}")),
    ("WHATSAPP",    re.compile(r"WhatsApp\s*[:：]?\s*\+?\d[\d\s\-]{6,}")),
    ("QQ",          re.compile(r"\bQQ\s*[:：]?\s*\d{5,12}\b")),
    # 中文地址前缀整段：地址：xxxxxx 到行尾
    ("CN_ADDRESS",  re.compile(r"(?:地\s*址|公司地址|公司\s*Address)\s*[:：]?\s*\S[\S ]{4,80}")),
]


class Hit(NamedTuple):
    page: int
    bbox: tuple[float, float, float, float]  # (x0, y0, x1, y1)
    label: str
    text: str


def find_hits_on_page(page: fitz.Page) -> list[Hit]:
    """
    按 fitz 的 dict 结构遍历每个 span（行内 token），先用 regex 匹配字符串，
    匹配命中的 span 整体框选下来。这样对中文连续段的覆盖会更稳，比按字符切 bbox 安全。
    """
    out: list[Hit] = []
    text_dict = page.get_text("dict")
    for block in text_dict.get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text = span.get("text", "") or ""
                if not text.strip():
                    continue
                for label, pat in PATTERNS:
                    if pat.search(text):
                        bbox = span.get("bbox")
                        if bbox and len(bbox) == 4:
                            out.append(Hit(page.number, tuple(bbox), label, text.strip()))
                        break  # 一个 span 一个标签即可，避免重复
    return out


def redact_pdf(input_path: Path, output_path: Path, dry_run: bool = False) -> dict[str, int]:
    """
    处理一个 PDF。返回每个 label 的命中计数 dict。
    """
    doc = fitz.open(str(input_path))
    counts: dict[str, int] = {}

    for page in doc:
        hits = find_hits_on_page(page)
        for h in hits:
            counts[h.label] = counts.get(h.label, 0) + 1
            if not dry_run:
                # 用白色填充矩形遮盖；apply_redactions() 会真正删掉文本（含可被搜索的）
                page.add_redact_annot(h.bbox, fill=(1, 1, 1))
        if not dry_run and hits:
            page.apply_redactions()

    if dry_run:
        # 打印命中明细到 stderr，便于人工 review
        for page in doc:
            for h in find_hits_on_page(page):
                print(f"  [{h.label}] p{h.page+1}: {h.text}", file=sys.stderr)
    else:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        doc.save(str(output_path), garbage=4, deflate=True, clean=True)

    doc.close()
    return counts


def iter_pdf_paths(root: Path) -> Iterable[Path]:
    if root.is_file() and root.suffix.lower() == ".pdf":
        yield root
    elif root.is_dir():
        for p in sorted(root.rglob("*.pdf")):
            # 跳过已经 redacted 的输出
            if "redacted" in p.parts:
                continue
            yield p


def main() -> int:
    ap = argparse.ArgumentParser(description="PDF 联系方式打白工具")
    ap.add_argument("input", type=Path, help="单个 PDF 或目录（递归找 *.pdf）")
    ap.add_argument("-o", "--output", type=Path, help="单文件输出路径（默认 <input>.redacted.pdf）")
    ap.add_argument("--batch", action="store_true", help="批量模式 —— 把每个 PDF 输出到 redacted/<原相对路径>")
    ap.add_argument("--dry-run", action="store_true", help="只检测不输出，命中明细打到 stderr")
    args = ap.parse_args()

    if not args.input.exists():
        print(f"ERROR: input 不存在: {args.input}", file=sys.stderr)
        return 2

    paths = list(iter_pdf_paths(args.input))
    if not paths:
        print(f"ERROR: 没找到 PDF 文件", file=sys.stderr)
        return 2

    total = {"_files": 0, "_hits": 0}

    for pdf in paths:
        if args.batch:
            rel = pdf.relative_to(args.input) if pdf.is_relative_to(args.input) else Path(pdf.name)
            out = args.input / "redacted" / rel
        elif args.output:
            out = args.output
        else:
            out = pdf.with_suffix(".redacted.pdf")

        try:
            counts = redact_pdf(pdf, out, dry_run=args.dry_run)
        except Exception as e:
            print(f"  FAIL {pdf}: {e}", file=sys.stderr)
            continue

        total["_files"] += 1
        hits_in_file = sum(counts.values())
        total["_hits"] += hits_in_file
        for k, v in counts.items():
            total[k] = total.get(k, 0) + v

        action = "would redact" if args.dry_run else "redacted"
        breakdown = ", ".join(f"{k}={v}" for k, v in sorted(counts.items()) if not k.startswith("_"))
        print(f"{action} [{hits_in_file:3d}] {pdf.name}  ({breakdown or 'no hits'})"
              + (f"  → {out}" if not args.dry_run else ""))

    print(file=sys.stderr)
    print(f"=== 汇总 ===  {total['_files']} files, {total['_hits']} hits", file=sys.stderr)
    for k in sorted(total.keys()):
        if not k.startswith("_"):
            print(f"  {k}: {total[k]}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
