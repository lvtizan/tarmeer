#!/usr/bin/env python3
"""
Detect images containing people/faces in project database.
Uses OpenCV Haar Cascade (local, free, no API needed).

Usage:
  python3 scripts/detect-people.py           # Scan and report
  python3 scripts/detect-people.py --apply   # Scan and remove from DB
  python3 scripts/detect-people.py --html    # Generate visual review page
"""
import sys
import os
import json
import tempfile
import hashlib
import cv2
import numpy as np
import pymysql
import requests
from pathlib import Path
from urllib.parse import urlparse

# --- Config ---
DB_CONFIG = dict(host='localhost', port=3306, user='root', password='', database='tarmeer')
BASE_URL = 'https://www.tarmeer.com'
LOCAL_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), '..', 'server', 'public')
CACHE_DIR = os.path.join(tempfile.gettempdir(), 'tarmeer-img-cache')
CONFIDENCE_THRESHOLD = 4  # minimum detections across all cascades to flag as "has person"

# --- Cascades ---
CASCADE_DIR = os.path.dirname(cv2.__file__) + '/data/'
CASCADES = {
    'face_front': cv2.CascadeClassifier(CASCADE_DIR + 'haarcascade_frontalface_alt2.xml'),
    'face_profile': cv2.CascadeClassifier(CASCADE_DIR + 'haarcascade_profileface.xml'),
    'upperbody': cv2.CascadeClassifier(CASCADE_DIR + 'haarcascade_upperbody.xml'),
    'fullbody': cv2.CascadeClassifier(CASCADE_DIR + 'haarcascade_fullbody.xml'),
}


def resolve_image_path(url: str) -> str:
    """Convert image URL to local path or download URL."""
    if url.startswith('/uploads/'):
        local = os.path.join(LOCAL_UPLOAD_DIR, url.lstrip('/'))
        if os.path.exists(local):
            return local
    if url.startswith('/'):
        return BASE_URL + url
    return url


def download_image(url: str) -> np.ndarray | None:
    """Download image and return as OpenCV array. Uses file cache."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_key = hashlib.md5(url.encode()).hexdigest()
    cache_path = os.path.join(CACHE_DIR, cache_key + '.jpg')

    if os.path.exists(cache_path):
        img = cv2.imread(cache_path)
        if img is not None:
            return img

    # Try local file first
    resolved = resolve_image_path(url)
    if os.path.exists(resolved):
        img = cv2.imread(resolved)
        if img is not None:
            return img

    # Download
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Tarmeer Image Scanner)'}
        resp = requests.get(resolved, headers=headers, timeout=10, stream=True)
        if resp.status_code != 200:
            return None
        data = np.frombuffer(resp.content, np.uint8)
        img = cv2.imdecode(data, cv2.IMREAD_COLOR)
        if img is not None:
            cv2.imwrite(cache_path, img)
        return img
    except Exception as e:
        print(f'  [WARN] Download failed: {url} — {e}')
        return None


def detect_people(img: np.ndarray) -> dict:
    """Run all cascades on image. Returns detection counts."""
    # Resize for speed (max 800px wide)
    h, w = img.shape[:2]
    scale = min(1.0, 800 / w)
    if scale < 1.0:
        img = cv2.resize(img, (int(w * scale), int(h * scale)))

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    results = {}
    for name, cascade in CASCADES.items():
        if name == 'fullbody':
            # Full body needs larger minSize
            detections = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(40, 80))
        elif name == 'upperbody':
            detections = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(40, 40))
        else:
            # Face detectors — higher minNeighbors to reduce false positives on textures
            detections = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(30, 30))

        count = len(detections) if isinstance(detections, np.ndarray) else 0
        results[name] = count

    return results


def get_all_project_images(conn) -> list:
    """Fetch all project images from DB."""
    with conn.cursor() as cur:
        # Registered company projects
        cur.execute("""
            SELECT p.id, p.title, p.images, p.company_profile_id, 'registered' as source
            FROM projects p
            WHERE p.deleted_at IS NULL AND p.images IS NOT NULL AND p.images != '[]'
        """)
        registered = list(cur.fetchall())

        # Directory company portfolio images
        cur.execute("""
            SELECT uc.id, uc.name_en, uc.portfolio_images, NULL, 'directory' as source
            FROM uae_companies uc
            WHERE uc.is_active = 1
              AND uc.portfolio_images IS NOT NULL
              AND uc.portfolio_images != '[]'
              AND uc.portfolio_images != ''
        """)
        directory = list(cur.fetchall())

    return registered, directory


def parse_images(images_json: str) -> list:
    """Parse JSON images field."""
    try:
        data = json.loads(images_json) if isinstance(images_json, str) else images_json
        if isinstance(data, list):
            return [url for url in data if isinstance(url, str) and url]
        if isinstance(data, dict):
            # Directory format: { category: [{url, title}, ...] }
            urls = []
            for cat_items in data.values():
                if isinstance(cat_items, list):
                    for item in cat_items:
                        if isinstance(item, dict) and item.get('url'):
                            urls.append(item['url'])
                        elif isinstance(item, str):
                            urls.append(item)
            return urls
    except (json.JSONDecodeError, TypeError):
        pass
    return []


def main():
    apply_mode = '--apply' in sys.argv
    html_mode = '--html' in sys.argv

    conn = pymysql.connect(**DB_CONFIG)
    registered, directory = get_all_project_images(conn)

    print(f'Scanning {len(registered)} registered projects + {len(directory)} directory companies...')

    flagged = []  # (source, id, title, url, detections)
    total_images = 0
    total_flagged = 0

    # Process registered projects
    for project_id, title, images_json, company_id, source in registered:
        urls = parse_images(images_json)
        for url in urls:
            total_images += 1
            sys.stdout.write(f'\r  Scanning [{total_images}] {url[:60]}...')
            sys.stdout.flush()

            img = download_image(url)
            if img is None:
                continue

            results = detect_people(img)
            total_detections = sum(results.values())

            if total_detections >= CONFIDENCE_THRESHOLD:
                total_flagged += 1
                flagged.append((source, project_id, title, url, results))
                print(f'\n  *** PERSON DETECTED: project={project_id} "{title}" — {url}')
                print(f'      Detections: {results}')

    # Process directory companies
    for company_id, name, portfolio_json, _, source in directory:
        urls = parse_images(portfolio_json)
        for url in urls:
            total_images += 1
            sys.stdout.write(f'\r  Scanning [{total_images}] {url[:60]}...')
            sys.stdout.flush()

            img = download_image(url)
            if img is None:
                continue

            results = detect_people(img)
            total_detections = sum(results.values())

            if total_detections >= CONFIDENCE_THRESHOLD:
                total_flagged += 1
                flagged.append((source, company_id, name, url, results))
                print(f'\n  *** PERSON DETECTED: company={company_id} "{name}" — {url}')
                print(f'      Detections: {results}')

    print(f'\n\nScan complete: {total_images} images scanned, {total_flagged} flagged with people.')

    if not flagged:
        print('No images with people detected!')
        conn.close()
        return

    # Report
    print('\n=== FLAGGED IMAGES ===')
    for source, obj_id, title, url, detections in flagged:
        det_str = ', '.join(f'{k}={v}' for k, v in detections.items() if v > 0)
        print(f'  [{source}] id={obj_id} "{title}" — {url}')
        print(f'    {det_str}')

    # Generate HTML review page
    if html_mode or not apply_mode:
        html_path = os.path.join(os.path.dirname(__file__), '..', 'people-detected.html')
        with open(html_path, 'w') as f:
            f.write('''<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>People Detection Results</title>
<style>
body { font-family: -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #faf9f7; }
h1 { color: #2c2c2c; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.card { background: white; border-radius: 12px; overflow: hidden; border: 2px solid #e7e5e4; }
.card.confirmed { border-color: #ef4444; }
.card img { width: 100%; height: 200px; object-fit: cover; }
.card .info { padding: 12px; }
.card .info h3 { margin: 0 0 4px; font-size: 14px; color: #1c1917; }
.card .info p { margin: 0; font-size: 12px; color: #6b6b6b; }
.card .info .det { font-size: 11px; color: #b8864a; margin-top: 4px; }
.card .actions { padding: 8px 12px; border-top: 1px solid #e7e5e4; }
.card .actions label { font-size: 13px; cursor: pointer; }
.summary { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
</style></head><body>
<h1>People Detection Results</h1>
<div class="summary">Found <strong>''' + str(len(flagged)) + '''</strong> images with possible people out of ''' + str(total_images) + ''' total.</div>
<div class="grid">''')
            for source, obj_id, title, url, detections in flagged:
                det_str = ', '.join(f'{k}={v}' for k, v in detections.items() if v > 0)
                img_url = url if url.startswith('http') else BASE_URL + url
                f.write(f'''
<div class="card">
  <img src="{img_url}" alt="{title}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22280%22 height=%22200%22><text x=%2250%%25%22 y=%2250%%25%22 text-anchor=%22middle%22 fill=%22%23999%22>Failed</text></svg>'" />
  <div class="info">
    <h3>{title or "Untitled"}</h3>
    <p>[{source}] id={obj_id}</p>
    <p class="det">{det_str}</p>
    <p style="font-size:10px;color:#aaa;word-break:break-all;margin-top:4px">{url}</p>
  </div>
</div>''')
            f.write('</div></body></html>')
        print(f'\nHTML review page: {os.path.abspath(html_path)}')

    # Apply removals
    if apply_mode:
        print('\n=== REMOVING FLAGGED IMAGES FROM DATABASE ===')
        with conn.cursor() as cur:
            for source, obj_id, title, url, detections in flagged:
                if source == 'registered':
                    cur.execute('SELECT images FROM projects WHERE id = %s', (obj_id,))
                    row = cur.fetchone()
                    if row and row[0]:
                        images = json.loads(row[0]) if isinstance(row[0], str) else row[0]
                        new_images = [u for u in images if u != url]
                        if len(new_images) < len(images):
                            cur.execute('UPDATE projects SET images = %s WHERE id = %s',
                                        (json.dumps(new_images), obj_id))
                            print(f'  Removed from project {obj_id}: {url}')
                elif source == 'directory':
                    cur.execute('SELECT portfolio_images FROM uae_companies WHERE id = %s', (obj_id,))
                    row = cur.fetchone()
                    if row and row[0]:
                        portfolio = json.loads(row[0]) if isinstance(row[0], str) else row[0]
                        changed = False
                        if isinstance(portfolio, dict):
                            for cat, items in portfolio.items():
                                if isinstance(items, list):
                                    new_items = [i for i in items if not (isinstance(i, dict) and i.get('url') == url) and not (isinstance(i, str) and i == url)]
                                    if len(new_items) < len(items):
                                        portfolio[cat] = new_items
                                        changed = True
                        if changed:
                            cur.execute('UPDATE uae_companies SET portfolio_images = %s WHERE id = %s',
                                        (json.dumps(portfolio), obj_id))
                            print(f'  Removed from company {obj_id}: {url}')

        conn.commit()
        print(f'\nDone! Removed {total_flagged} images from database.')

    conn.close()


if __name__ == '__main__':
    main()
