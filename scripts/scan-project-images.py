#!/usr/bin/env python3
"""
扫描所有项目的 images 字段，检查：
1. 图片 URL 是否有效（文件是否存在）
2. images 字段格式是否正常（字符串数组 vs 对象数组）
3. 是否有空/损坏的条目

用法:
  python3 scripts/scan-project-images.py                    # 扫描全部
  python3 scripts/scan-project-images.py --fix              # 扫描并修复（清除无效条目）
  python3 scripts/scan-project-images.py --project-id 1072  # 扫描指定项目

环境变量:
  DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (默认 localhost/root//tarmeer)
  UPLOADS_BASE (默认 /tarmeer/tarmeer_api/public)
"""

import json
import os
import sys
import argparse
from pathlib import Path

try:
    import mysql.connector
except ImportError:
    print("需要 mysql-connector-python: pip3 install mysql-connector-python")
    sys.exit(1)


def connect_db():
    return mysql.connector.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", ""),
        database=os.environ.get("DB_NAME", "tarmeer"),
    )


def parse_images(raw):
    """解析 images 字段，返回列表"""
    if not raw:
        return []
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return []
    else:
        parsed = raw
    if not isinstance(parsed, list):
        return []
    return parsed


def extract_url(item):
    """从 images 条目提取 URL"""
    if isinstance(item, str):
        return item
    if isinstance(item, dict):
        return item.get("url") or item.get("src") or item.get("imageUrl") or ""
    return ""


def check_file_exists(url, uploads_base):
    """检查图片文件是否存在"""
    if not url or url.startswith("http"):
        return True  # 外部 URL，跳过
    path = Path(uploads_base) / url.lstrip("/")
    return path.exists()


def scan_projects(conn, project_id=None, uploads_base="/tarmeer/tarmeer_api/public", fix=False):
    cursor = conn.cursor(dictionary=True)

    query = "SELECT id, company_profile_id, title, images FROM projects WHERE deleted_at IS NULL"
    params = []
    if project_id:
        query += " AND id = %s"
        params.append(project_id)
    query += " ORDER BY id"

    cursor.execute(query, params)
    projects = cursor.fetchall()

    total = len(projects)
    issues = []
    stats = {
        "total_projects": total,
        "total_images": 0,
        "object_format": 0,     # images 是对象数组 {url, ai_tags}
        "string_format": 0,     # images 是字符串数组
        "mixed_format": 0,      # 混合格式
        "missing_files": 0,     # 文件不存在
        "empty_urls": 0,        # 空 URL
        "tag_leak": 0,          # ai_tags 被当成图片 URL 的
    }

    for p in projects:
        pid = p["id"]
        title = p["title"] or "Untitled"
        items = parse_images(p["images"])

        if not items:
            continue

        urls = []
        has_objects = False
        has_strings = False
        tag_leak_count = 0

        for item in items:
            url = extract_url(item)

            if isinstance(item, dict):
                has_objects = True
                # 检查是否有 ai_tags 泄漏风险
                tags = item.get("ai_tags", [])
                if isinstance(tags, list):
                    tag_leak_count += len(tags)
            elif isinstance(item, str):
                has_strings = True

            if url:
                urls.append(url)
            else:
                stats["empty_urls"] += 1
                issues.append(f"[EMPTY_URL] project #{pid} '{title}' — 空 URL 条目")

        stats["total_images"] += len(urls)

        if has_objects and has_strings:
            stats["mixed_format"] += 1
            issues.append(f"[MIXED] project #{pid} '{title}' — 混合格式（对象+字符串）")
        elif has_objects:
            stats["object_format"] += 1
        else:
            stats["string_format"] += 1

        if has_objects and tag_leak_count > 0:
            stats["tag_leak"] += 1
            expected = len([i for i in items if isinstance(i, dict) and (i.get("url") or i.get("src"))])
            if expected != len(urls):
                issues.append(
                    f"[TAG_LEAK] project #{pid} '{title}' — {len(items)} 条目但只有 {expected} 张图，"
                    f"ai_tags 可能泄漏 ({tag_leak_count} tags)"
                )

        # 检查文件是否存在
        for url in urls:
            if not check_file_exists(url, uploads_base):
                stats["missing_files"] += 1
                issues.append(f"[MISSING] project #{pid} '{title}' — {url}")

        # 修复：如果是对象数组，提取纯 URL 数组存回去
        if fix and has_objects:
            clean_images = []
            for item in items:
                if isinstance(item, dict):
                    # 保留完整对象（含 ai_tags），只是确保 url 存在
                    u = item.get("url") or item.get("src") or ""
                    if u:
                        clean_images.append(item)
                elif isinstance(item, str) and item:
                    clean_images.append(item)

            if len(clean_images) != len(items):
                cursor.execute(
                    "UPDATE projects SET images = %s WHERE id = %s",
                    [json.dumps(clean_images), pid]
                )
                print(f"  FIXED project #{pid}: {len(items)} → {len(clean_images)} images")

    if fix:
        conn.commit()

    return stats, issues


def main():
    parser = argparse.ArgumentParser(description="扫描项目图片数据完整性")
    parser.add_argument("--fix", action="store_true", help="修复无效条目")
    parser.add_argument("--project-id", type=int, help="扫描指定项目")
    parser.add_argument("--uploads-base", default="/tarmeer/tarmeer_api/public", help="uploads 根目录")
    args = parser.parse_args()

    conn = connect_db()
    try:
        stats, issues = scan_projects(
            conn,
            project_id=args.project_id,
            uploads_base=args.uploads_base,
            fix=args.fix,
        )
    finally:
        conn.close()

    print("\n" + "=" * 60)
    print("  项目图片扫描报告")
    print("=" * 60)
    print(f"  总项目数:    {stats['total_projects']}")
    print(f"  总图片数:    {stats['total_images']}")
    print(f"  对象格式:    {stats['object_format']} 个项目（含 ai_tags）")
    print(f"  字符串格式:  {stats['string_format']} 个项目")
    print(f"  混合格式:    {stats['mixed_format']} 个项目")
    print(f"  文件缺失:    {stats['missing_files']} 张")
    print(f"  空 URL:      {stats['empty_urls']} 条")
    print(f"  标签泄漏风险: {stats['tag_leak']} 个项目")
    print("=" * 60)

    if issues:
        print(f"\n  发现 {len(issues)} 个问题:\n")
        for issue in issues[:50]:
            print(f"  {issue}")
        if len(issues) > 50:
            print(f"\n  ... 还有 {len(issues) - 50} 个问题")
    else:
        print("\n  所有项目图片正常")

    print()
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
