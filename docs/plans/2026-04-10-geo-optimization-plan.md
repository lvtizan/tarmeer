# GEO Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Optimize tarmeer.com for AI search engines via prerender service, structured data, FAQ page, dynamic sitemap, and auto-maintenance.

**Architecture:** Puppeteer prerender service on port 3003 behind nginx UA detection. Python watchdog for auto-ops. Frontend gets new FAQ page + JSON-LD on all public pages. Backend sitemap enhanced with project URLs.

**Tech Stack:** Node.js/Puppeteer (prerender), Python 3 (watchdog), React/Helmet (frontend), Express (backend sitemap)

---

### Task 1: Prerender Service — package.json + pm2 config

**Files:**
- Create: `server/prerender/package.json`
- Create: `server/prerender/ecosystem.config.js`

**Step 1: Create prerender package.json**

```json
{
  "name": "tarmeer-prerender",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "puppeteer": "^23.0.0"
  }
}
```

**Step 2: Create pm2 ecosystem config**

```js
module.exports = {
  apps: [{
    name: 'tarmeer-prerender',
    script: 'index.js',
    cwd: __dirname,
    instances: 1,
    max_memory_restart: '512M',
    env: {
      PORT: 3003,
      CACHE_DIR: '/tarmeer/prerender-cache',
      CACHE_TTL_MS: 24 * 60 * 60 * 1000,
      RENDER_TIMEOUT_MS: 15000,
      TARGET_HOST: 'http://127.0.0.1:80',
    },
  }],
};
```

**Step 3: Install dependencies**

Run: `cd server/prerender && npm install`

**Step 4: Commit**

```bash
git add server/prerender/package.json server/prerender/package-lock.json server/prerender/ecosystem.config.js
git commit -m "feat(geo): add prerender service scaffolding with pm2 config"
```

---

### Task 2: Prerender Service — Express + Puppeteer renderer

**Files:**
- Create: `server/prerender/index.js`

**Step 1: Create the prerender service**

```js
const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3003;
const CACHE_DIR = process.env.CACHE_DIR || '/tarmeer/prerender-cache';
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS) || 24 * 60 * 60 * 1000;
const RENDER_TIMEOUT_MS = parseInt(process.env.RENDER_TIMEOUT_MS) || 15000;
const TARGET_HOST = process.env.TARGET_HOST || 'http://127.0.0.1:80';

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

let browser = null;

async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
    });
  }
  return browser;
}

function getCacheKey(url) {
  return crypto.createHash('md5').update(url).digest('hex') + '.html';
}

function getCachedHTML(cacheFile) {
  if (!fs.existsSync(cacheFile)) return null;
  const stat = fs.statSync(cacheFile);
  if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) {
    fs.unlinkSync(cacheFile);
    return null;
  }
  return fs.readFileSync(cacheFile, 'utf-8');
}

async function renderPage(url) {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setUserAgent('TarmeerPrerender/1.0');
    await page.goto(url, { waitUntil: 'networkidle0', timeout: RENDER_TIMEOUT_MS });
    // Wait for Helmet to inject meta tags
    await page.waitForSelector('title', { timeout: 5000 }).catch(() => {});
    return await page.content();
  } finally {
    await page.close();
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', cached: fs.readdirSync(CACHE_DIR).length });
});

// Clear cache
app.post('/clear-cache', (req, res) => {
  const files = fs.readdirSync(CACHE_DIR);
  files.forEach(f => fs.unlinkSync(path.join(CACHE_DIR, f)));
  res.json({ cleared: files.length });
});

// Render any path
app.get('*', async (req, res) => {
  const urlPath = req.originalUrl.replace('/prerenderproxy', '') || '/';
  const targetUrl = `${TARGET_HOST}${urlPath}`;
  const cacheFile = path.join(CACHE_DIR, getCacheKey(urlPath));

  // Try cache first
  const cached = getCachedHTML(cacheFile);
  if (cached) {
    res.set('Content-Type', 'text/html');
    res.set('X-Prerender-Cache', 'HIT');
    return res.send(cached);
  }

  try {
    const html = await renderPage(targetUrl);
    // Cache to disk
    fs.writeFileSync(cacheFile, html);
    res.set('Content-Type', 'text/html');
    res.set('X-Prerender-Cache', 'MISS');
    res.send(html);
  } catch (err) {
    console.error(`[Prerender] Error rendering ${urlPath}:`, err.message);
    res.status(503).send('Prerender failed');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (browser) await browser.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`[Prerender] Service running on port ${PORT}`);
  console.log(`[Prerender] Cache dir: ${CACHE_DIR}, TTL: ${CACHE_TTL_MS / 1000}s`);
});
```

**Step 2: Test locally**

Run: `cd server/prerender && node index.js`
Expected: `[Prerender] Service running on port 3003`
Then: `curl http://localhost:3003/health`
Expected: `{"status":"ok","cached":0}`

**Step 3: Commit**

```bash
git add server/prerender/index.js
git commit -m "feat(geo): implement prerender service with Puppeteer + disk cache"
```

---

### Task 3: Prerender — nginx config reference

**Files:**
- Create: `server/prerender/nginx-prerender.conf.example`

NOTE: This is a REFERENCE file only. Per project rules, nginx configs are NEVER auto-deployed.

**Step 1: Create nginx config example**

```nginx
# GEO Prerender — add to server block in tarmeer.conf
# MANUAL DEPLOY ONLY — never auto-applied

# Bot detection
set $prerender 0;
if ($http_user_agent ~* "Googlebot|Google-InspectionTool|Storebot-Google|Bingbot|msnbot|PerplexityBot|ChatGPT-User|ClaudeBot|GPTBot|Applebot|anthropic-ai|cohere-ai|Twitterbot|facebookexternalhit|LinkedInBot|WhatsApp|Screaming\ Frog|SemrushBot|AhrefsBot") {
    set $prerender 1;
}

# Skip prerender for static assets
if ($uri ~* "\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp|mp4)$") {
    set $prerender 0;
}

# Skip prerender for API calls
if ($uri ~ ^/api/) {
    set $prerender 0;
}

location / {
    # Prerender proxy
    if ($prerender = 1) {
        rewrite (.*) /prerenderproxy$1 break;
        proxy_pass http://127.0.0.1:3003;
    }

    # Normal SPA fallback
    try_files $uri $uri/ /index.html;
}
```

**Step 2: Commit**

```bash
git add server/prerender/nginx-prerender.conf.example
git commit -m "docs(geo): add nginx prerender config reference (manual deploy only)"
```

---

### Task 4: Python Watchdog — config + requirements

**Files:**
- Create: `server/prerender/ops/requirements.txt`
- Create: `server/prerender/ops/config.ini`

**Step 1: Create requirements.txt**

```
requests>=2.31.0
```

**Step 2: Create config.ini**

```ini
[prerender]
health_url = http://127.0.0.1:3003/health
pm2_process_name = tarmeer-prerender
cache_dir = /tarmeer/prerender-cache
cache_ttl_hours = 24
max_failures_before_restart = 3

[smtp]
host = smtp.qiye.aliyun.com
port = 465
use_ssl = true
username = alert@kp99.cn
password = CHANGE_ME
from_addr = alert@kp99.cn
to_addr = lvyiming@kp99.cn

[schedule]
health_check_interval_min = 5
cache_cleanup_hour = 3
chromium_update_day = sunday
ua_sync_day = 1

[thresholds]
disk_warn_percent = 80
```

**Step 3: Commit**

```bash
git add server/prerender/ops/requirements.txt server/prerender/ops/config.ini
git commit -m "feat(geo): add watchdog config and Python requirements"
```

---

### Task 5: Python Watchdog — main script

**Files:**
- Create: `server/prerender/ops/geo_watchdog.py`

**Step 1: Create the watchdog script**

```python
#!/usr/bin/env python3
"""
Tarmeer GEO Prerender Watchdog
- Health check (every 5 min via cron)
- Process restart on 3 consecutive failures
- Cache cleanup (daily at 3 AM)
- Chromium auto-update (weekly)
- Crawler UA list sync (monthly)
- Email alerts to lvyiming@kp99.cn
"""

import argparse
import configparser
import json
import logging
import os
import shutil
import smtplib
import ssl
import subprocess
import sys
import time
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from pathlib import Path

import requests

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
STATE_FILE = Path(__file__).parent / ".watchdog_state.json"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "watchdog.log"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger("geo_watchdog")


def load_config():
    cfg = configparser.ConfigParser()
    cfg.read(Path(__file__).parent / "config.ini")
    return cfg


def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"consecutive_failures": 0, "last_chromium_update": "", "last_ua_sync": ""}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2))


# ── Email ──────────────────────────────────────────────

def send_alert(cfg, subject, body):
    smtp_cfg = cfg["smtp"]
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = f"[Tarmeer GEO] {subject}"
    msg["From"] = smtp_cfg["from_addr"]
    msg["To"] = smtp_cfg["to_addr"]

    try:
        if smtp_cfg.getboolean("use_ssl"):
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(smtp_cfg["host"], int(smtp_cfg["port"]), context=ctx) as s:
                s.login(smtp_cfg["username"], smtp_cfg["password"])
                s.send_message(msg)
        else:
            with smtplib.SMTP(smtp_cfg["host"], int(smtp_cfg["port"])) as s:
                s.starttls()
                s.login(smtp_cfg["username"], smtp_cfg["password"])
                s.send_message(msg)
        log.info(f"Alert sent: {subject}")
    except Exception as e:
        log.error(f"Failed to send alert: {e}")


# ── Health Check ───────────────────────────────────────

def cmd_health(cfg):
    state = load_state()
    url = cfg["prerender"]["health_url"]
    pm2_name = cfg["prerender"]["pm2_process_name"]
    max_fail = int(cfg["prerender"]["max_failures_before_restart"])

    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200 and "ok" in r.text:
            state["consecutive_failures"] = 0
            save_state(state)
            log.info(f"Health OK: {r.json()}")
            return
    except Exception as e:
        log.warning(f"Health check failed: {e}")

    state["consecutive_failures"] += 1
    save_state(state)
    log.warning(f"Failure #{state['consecutive_failures']}/{max_fail}")

    if state["consecutive_failures"] >= max_fail:
        log.error("Max failures reached — restarting prerender service")
        subprocess.run(["pm2", "restart", pm2_name], capture_output=True)
        state["consecutive_failures"] = 0
        save_state(state)
        send_alert(cfg, "Service Restarted",
                   f"Prerender service restarted after {max_fail} consecutive health check failures.\n"
                   f"Time: {datetime.now().isoformat()}")


# ── Cache Cleanup ──────────────────────────────────────

def cmd_cache_cleanup(cfg):
    cache_dir = Path(cfg["prerender"]["cache_dir"])
    ttl_hours = int(cfg["prerender"]["cache_ttl_hours"])
    cutoff = time.time() - ttl_hours * 3600
    removed = 0

    if not cache_dir.exists():
        log.info("Cache dir does not exist, skipping cleanup")
        return

    for f in cache_dir.iterdir():
        if f.is_file() and f.stat().st_mtime < cutoff:
            f.unlink()
            removed += 1

    log.info(f"Cache cleanup: removed {removed} expired files")

    # Disk usage check
    usage = shutil.disk_usage(str(cache_dir))
    pct = (usage.used / usage.total) * 100
    threshold = int(cfg["thresholds"]["disk_warn_percent"])
    if pct > threshold:
        send_alert(cfg, f"Disk Usage Warning: {pct:.1f}%",
                   f"Disk usage on {cache_dir} is {pct:.1f}%, above {threshold}% threshold.\n"
                   f"Total: {usage.total // (1024**3)}GB, Used: {usage.used // (1024**3)}GB")


# ── Chromium Update ────────────────────────────────────

def cmd_chromium_update(cfg):
    state = load_state()
    prerender_dir = Path(__file__).parent.parent
    pm2_name = cfg["prerender"]["pm2_process_name"]

    log.info("Checking for Puppeteer/Chromium updates...")
    result = subprocess.run(
        ["npm", "outdated", "puppeteer", "--json"],
        cwd=str(prerender_dir), capture_output=True, text=True
    )

    if result.stdout.strip() and result.stdout.strip() != "{}":
        log.info("Puppeteer update available, installing...")
        subprocess.run(["npm", "update", "puppeteer"], cwd=str(prerender_dir), check=True)
        subprocess.run(["pm2", "restart", pm2_name], capture_output=True)
        state["last_chromium_update"] = datetime.now().isoformat()
        save_state(state)
        send_alert(cfg, "Chromium Updated",
                   f"Puppeteer/Chromium updated and prerender service restarted.\n"
                   f"Time: {datetime.now().isoformat()}")
    else:
        log.info("Puppeteer is up to date")


# ── Crawler UA Sync ────────────────────────────────────

BOT_UA_SOURCES = [
    "https://raw.githubusercontent.com/monperrus/crawler-user-agents/master/crawler-user-agents.json",
]

def cmd_ua_sync(cfg):
    state = load_state()
    ua_file = Path(__file__).parent / "known_bot_uas.json"

    all_uas = []
    for src in BOT_UA_SOURCES:
        try:
            r = requests.get(src, timeout=30)
            if r.status_code == 200:
                data = r.json()
                for entry in data:
                    pattern = entry.get("pattern", "")
                    if pattern:
                        all_uas.append(pattern)
        except Exception as e:
            log.warning(f"Failed to fetch UA list from {src}: {e}")

    if all_uas:
        ua_file.write_text(json.dumps(sorted(set(all_uas)), indent=2))
        state["last_ua_sync"] = datetime.now().isoformat()
        save_state(state)
        log.info(f"UA sync complete: {len(set(all_uas))} patterns saved")
    else:
        log.warning("No UA patterns fetched")


# ── CLI ────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Tarmeer GEO Prerender Watchdog")
    parser.add_argument("command", choices=["health", "cache-cleanup", "chromium-update", "ua-sync", "status"])
    args = parser.parse_args()

    cfg = load_config()

    if args.command == "health":
        cmd_health(cfg)
    elif args.command == "cache-cleanup":
        cmd_cache_cleanup(cfg)
    elif args.command == "chromium-update":
        cmd_chromium_update(cfg)
    elif args.command == "ua-sync":
        cmd_ua_sync(cfg)
    elif args.command == "status":
        state = load_state()
        print(json.dumps(state, indent=2))


if __name__ == "__main__":
    main()
```

**Step 2: Create crontab reference**

Create: `server/prerender/ops/crontab.example`

```
# Tarmeer GEO Watchdog — add to server crontab
# Health check every 5 minutes
*/5 * * * * cd /tarmeer/tarmeer_web_portal/server/prerender/ops && /usr/bin/python3 geo_watchdog.py health >> logs/cron.log 2>&1

# Cache cleanup daily at 3 AM
0 3 * * * cd /tarmeer/tarmeer_web_portal/server/prerender/ops && /usr/bin/python3 geo_watchdog.py cache-cleanup >> logs/cron.log 2>&1

# Chromium update check every Sunday at 4 AM
0 4 * * 0 cd /tarmeer/tarmeer_web_portal/server/prerender/ops && /usr/bin/python3 geo_watchdog.py chromium-update >> logs/cron.log 2>&1

# Crawler UA sync on 1st of each month at 4 AM
0 4 1 * * cd /tarmeer/tarmeer_web_portal/server/prerender/ops && /usr/bin/python3 geo_watchdog.py ua-sync >> logs/cron.log 2>&1
```

**Step 3: Commit**

```bash
git add server/prerender/ops/geo_watchdog.py server/prerender/ops/crontab.example
git commit -m "feat(geo): add Python watchdog with health check, cache cleanup, Chromium update, UA sync, email alerts"
```

---

### Task 6: FAQ Page — create FaqPage.tsx

**Files:**
- Create: `src/pages/FaqPage.tsx`

**Step 1: Create the FAQ page with EN/AR content + toggle**

```tsx
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  q: { en: string; ar: string };
  a: { en: string; ar: string };
}

interface FaqCategory {
  title: { en: string; ar: string };
  items: FaqItem[];
}

const FAQ_DATA: FaqCategory[] = [
  {
    title: { en: 'Finding Design Companies', ar: 'البحث عن شركات التصميم' },
    items: [
      {
        q: { en: 'How do I choose an interior design company in the UAE?', ar: 'كيف أختار شركة تصميم داخلي في الإمارات؟' },
        a: { en: 'Look at their portfolio for projects similar to yours, check client reviews, verify they are licensed in the UAE, and ensure their style matches your vision. On Tarmeer, you can compare 50+ verified interior design companies across Dubai, Abu Dhabi, Sharjah, and other emirates — each with verified portfolios and direct contact.', ar: 'اطلع على مشاريعهم السابقة المشابهة لمشروعك، وتحقق من تقييمات العملاء، وتأكد من أنهم مرخصون في الإمارات، وأن أسلوبهم يتناسب مع رؤيتك. على تعمير، يمكنك مقارنة أكثر من 50 شركة تصميم داخلي معتمدة في دبي وأبوظبي والشارقة وغيرها — كل منها بمعرض أعمال موثق وتواصل مباشر.' },
      },
      {
        q: { en: 'How much does interior design cost in the UAE?', ar: 'كم تكلفة التصميم الداخلي في الإمارات؟' },
        a: { en: 'Interior design fees in the UAE typically range from AED 50 to AED 250 per square foot, depending on the scope, materials, and designer experience. A full villa design (300-500 sqm) may cost AED 80,000 to AED 400,000 including design fees and fit-out. Apartment renovations usually range from AED 30,000 to AED 150,000. Request quotes from multiple companies on Tarmeer to compare.', ar: 'تتراوح رسوم التصميم الداخلي في الإمارات عادةً من 50 إلى 250 درهم للقدم المربع، حسب النطاق والمواد وخبرة المصمم. قد يكلف تصميم فيلا كاملة (300-500 متر مربع) من 80,000 إلى 400,000 درهم شاملة رسوم التصميم والتنفيذ. تجديد الشقق عادةً يتراوح من 30,000 إلى 150,000 درهم. اطلب عروض أسعار من شركات متعددة على تعمير للمقارنة.' },
      },
      {
        q: { en: 'What should I look for in a design company portfolio?', ar: 'ما الذي يجب أن أبحث عنه في معرض أعمال شركة التصميم؟' },
        a: { en: 'Focus on projects similar to your property type (villa, apartment, office), check if they handle your preferred style (modern, Arabic, minimalist), look for before/after transformations, and verify they work in your emirate. High-resolution project photos with detailed descriptions indicate professionalism.', ar: 'ركز على المشاريع المشابهة لنوع عقارك (فيلا، شقة، مكتب)، وتحقق من أنهم يعملون بأسلوبك المفضل (حديث، عربي، بسيط)، وابحث عن صور قبل وبعد التحول، وتأكد من أنهم يعملون في إمارتك. الصور عالية الجودة مع الأوصاف التفصيلية تدل على الاحترافية.' },
      },
      {
        q: { en: 'Can I hire a designer from another emirate?', ar: 'هل يمكنني توظيف مصمم من إمارة أخرى؟' },
        a: { en: 'Yes, many design companies in the UAE operate across multiple emirates. A Dubai-based firm can handle projects in Abu Dhabi, Sharjah, or Ajman. Discuss travel fees and site visit logistics upfront. On Tarmeer, filter companies by their service areas to find those covering your location.', ar: 'نعم، العديد من شركات التصميم في الإمارات تعمل عبر إمارات متعددة. يمكن لشركة مقرها دبي تنفيذ مشاريع في أبوظبي أو الشارقة أو عجمان. ناقش رسوم التنقل وزيارات الموقع مسبقاً. على تعمير، يمكنك تصفية الشركات حسب مناطق خدمتها للعثور على من يغطي موقعك.' },
      },
      {
        q: { en: 'Do I need a permit for interior renovation in Dubai?', ar: 'هل أحتاج تصريح لتجديد الديكور الداخلي في دبي؟' },
        a: { en: 'Yes, most interior fit-out work in Dubai requires a permit from the relevant municipality or free zone authority. Your design company should handle the permit process as part of their service. Structural changes, MEP modifications, and commercial fit-outs always require permits. Simple cosmetic changes like painting may not.', ar: 'نعم، معظم أعمال التجهيز الداخلي في دبي تتطلب تصريحاً من البلدية أو سلطة المنطقة الحرة المختصة. يجب أن تتولى شركة التصميم عملية التصريح كجزء من خدماتها. التغييرات الهيكلية وتعديلات الأنظمة الكهربائية والميكانيكية والتجهيزات التجارية تتطلب دائماً تصاريح. التغييرات التجميلية البسيطة مثل الطلاء قد لا تحتاج.' },
      },
    ],
  },
  {
    title: { en: 'Design Inspiration & Styles', ar: 'إلهام التصميم والأنماط' },
    items: [
      {
        q: { en: 'What are the most popular interior design styles in UAE homes?', ar: 'ما هي أنماط التصميم الداخلي الأكثر شعبية في المنازل الإماراتية؟' },
        a: { en: 'The most popular styles in UAE homes are Modern Contemporary (clean lines, neutral palettes), Luxury Arabic (ornate details, gold accents, marble), Modern Arabic (traditional motifs with contemporary execution), and Minimalist (functional, clutter-free). Villa owners often prefer Modern Arabic or Luxury styles, while apartment residents lean toward Contemporary or Scandinavian-inspired designs.', ar: 'الأنماط الأكثر شعبية في المنازل الإماراتية هي المعاصر الحديث (خطوط نظيفة، ألوان محايدة)، العربي الفاخر (تفاصيل مزخرفة، لمسات ذهبية، رخام)، العربي الحديث (زخارف تقليدية بتنفيذ معاصر)، والبسيط (عملي، خالي من الفوضى). يفضل أصحاب الفلل عادةً الأسلوب العربي الحديث أو الفاخر، بينما يميل سكان الشقق إلى التصميم المعاصر أو المستوحى من الطراز الاسكندنافي.' },
      },
      {
        q: { en: 'How is villa design different from apartment design in the UAE?', ar: 'كيف يختلف تصميم الفلل عن تصميم الشقق في الإمارات؟' },
        a: { en: 'Villa design involves exterior facades, landscaping, multiple floors with staircase design, majlis/formal areas, and often servant quarters. Apartment design focuses on maximizing limited space, storage solutions, and working within fixed layouts. Villas typically cost 2-3x more due to larger area and greater complexity. Both benefit from climate-appropriate materials that handle UAE humidity and heat.', ar: 'يشمل تصميم الفلل الواجهات الخارجية والمناظر الطبيعية والطوابق المتعددة مع تصميم الدرج والمجلس والمناطق الرسمية وغالباً غرف الخدم. يركز تصميم الشقق على تعظيم المساحة المحدودة وحلول التخزين والعمل ضمن تخطيطات ثابتة. تكلفة الفلل عادةً 2-3 أضعاف بسبب المساحة الأكبر والتعقيد الأكثر. كلاهما يستفيد من مواد مناسبة للمناخ تتحمل رطوبة وحرارة الإمارات.' },
      },
      {
        q: { en: 'What design trends are popular in Dubai right now?', ar: 'ما هي اتجاهات التصميم الرائجة في دبي حالياً؟' },
        a: { en: 'Current Dubai design trends include: biophilic design (indoor greenery, natural materials), warm minimalism (beige/terracotta palettes replacing cool grays), statement lighting as sculptural art, integrated smart home technology, sustainable and locally-sourced materials, and mixed-use spaces that combine living with home offices. Japanese-inspired wabi-sabi aesthetics are also gaining popularity.', ar: 'تشمل اتجاهات التصميم الحالية في دبي: التصميم البيوفيلي (النباتات الداخلية، المواد الطبيعية)، البساطة الدافئة (ألوان البيج/التيراكوتا بدلاً من الرمادي البارد)، الإضاءة المميزة كفن نحتي، تكنولوجيا المنزل الذكي المدمجة، المواد المستدامة والمحلية، والمساحات متعددة الاستخدام التي تجمع بين السكن والمكتب المنزلي. جماليات الوابي-سابي اليابانية أيضاً تكتسب شعبية.' },
      },
      {
        q: { en: 'How do I design a modern majlis?', ar: 'كيف أصمم مجلساً عصرياً؟' },
        a: { en: 'A modern majlis blends traditional Arabian hospitality with contemporary design. Key elements include: low-profile seating along walls (but with modern upholstery), a mix of Arabic geometric patterns with clean lines, warm lighting with decorative lanterns or statement chandeliers, quality materials like marble flooring with carpet accents, and technology integration (hidden speakers, smart lighting). Many UAE designers specialize in modern majlis design — browse their work on Tarmeer.', ar: 'يمزج المجلس العصري بين الضيافة العربية التقليدية والتصميم المعاصر. العناصر الأساسية تشمل: مقاعد منخفضة على طول الجدران (لكن بتنجيد عصري)، مزيج من الأنماط الهندسية العربية مع الخطوط النظيفة، إضاءة دافئة مع فوانيس مزخرفة أو ثريات مميزة، مواد عالية الجودة مثل أرضيات الرخام مع لمسات السجاد، وتكامل التكنولوجيا (سماعات مخفية، إضاءة ذكية). العديد من مصممي الإمارات متخصصون في تصميم المجالس العصرية — تصفح أعمالهم على تعمير.' },
      },
      {
        q: { en: 'What materials work best for UAE climate?', ar: 'ما هي المواد الأفضل لمناخ الإمارات؟' },
        a: { en: 'For UAE interiors, choose materials that handle high humidity and temperature fluctuations: porcelain/ceramic tiles over hardwood (more stable), engineered stone over natural marble for countertops (less porous), moisture-resistant MDF for cabinetry, fade-resistant fabrics for sun-exposed areas, and anti-microbial finishes for bathrooms. For exteriors, use UV-resistant paints and thermal-insulating cladding.', ar: 'لداخل المنازل الإماراتية، اختر مواد تتحمل الرطوبة العالية وتقلبات الحرارة: بلاط البورسلين/السيراميك بدلاً من الخشب الصلب (أكثر استقراراً)، الحجر الصناعي بدلاً من الرخام الطبيعي لأسطح العمل (أقل مسامية)، خشب MDF المقاوم للرطوبة للخزائن، أقمشة مقاومة للبهتان للمناطق المعرضة للشمس، وتشطيبات مضادة للميكروبات للحمامات. للخارج، استخدم دهانات مقاومة للأشعة فوق البنفسجية وكسوة عازلة حرارياً.' },
      },
    ],
  },
  {
    title: { en: 'Renovation Services & Process', ar: 'خدمات التجديد والعملية' },
    items: [
      {
        q: { en: 'What is the typical renovation process in the UAE?', ar: 'ما هي عملية التجديد النموذجية في الإمارات؟' },
        a: { en: 'The typical process: 1) Initial consultation and site visit, 2) Concept design with mood boards, 3) Detailed drawings and 3D renderings, 4) Material selection and quotation, 5) Permit application (if needed), 6) Demolition and construction, 7) MEP rough-in (electrical, plumbing, AC), 8) Finishing works (flooring, painting, fixtures), 9) Furniture installation and styling, 10) Final walkthrough and handover. Timeline: 2-6 months depending on scope.', ar: 'العملية النموذجية: 1) استشارة أولية وزيارة للموقع، 2) تصميم مفاهيمي مع لوحات المزاج، 3) رسومات تفصيلية وتصورات ثلاثية الأبعاد، 4) اختيار المواد وعرض السعر، 5) طلب التصريح (إذا لزم الأمر)، 6) الهدم والبناء، 7) التمديدات (الكهرباء، السباكة، التكييف)، 8) أعمال التشطيب (الأرضيات، الطلاء، التركيبات)، 9) تركيب الأثاث والتنسيق، 10) الجولة النهائية والتسليم. المدة: 2-6 أشهر حسب النطاق.' },
      },
      {
        q: { en: 'How long does a full home renovation take in Dubai?', ar: 'كم تستغرق عملية تجديد منزل كامل في دبي؟' },
        a: { en: 'A full home renovation in Dubai typically takes: Studio/1BR apartment: 4-8 weeks, 2-3BR apartment: 8-12 weeks, Villa (up to 400 sqm): 3-5 months, Large villa (400+ sqm): 5-8 months. Add 2-4 weeks for design phase and 1-3 weeks for permit processing. Delays can occur due to material shipping (especially imported items), permit revisions, or scope changes.', ar: 'يستغرق التجديد الكامل في دبي عادةً: استوديو/غرفة واحدة: 4-8 أسابيع، شقة 2-3 غرف: 8-12 أسبوع، فيلا (حتى 400 متر مربع): 3-5 أشهر، فيلا كبيرة (400+ متر مربع): 5-8 أشهر. أضف 2-4 أسابيع لمرحلة التصميم و1-3 أسابيع لمعالجة التصاريح. قد تحدث تأخيرات بسبب شحن المواد (خاصة المستوردة) أو مراجعات التصاريح أو تغييرات النطاق.' },
      },
      {
        q: { en: 'What is the difference between design-only and design-build services?', ar: 'ما الفرق بين خدمات التصميم فقط وخدمات التصميم والبناء؟' },
        a: { en: 'Design-only: the firm creates drawings, 3D renders, and specifications, then you hire a separate contractor to execute. Design-build (turnkey): one company handles everything from concept to completed space. Design-build is usually 10-15% more expensive but offers single accountability, faster timelines, and better quality control. Most UAE homeowners prefer design-build for convenience.', ar: 'التصميم فقط: تقوم الشركة بإنشاء الرسومات والتصورات ثلاثية الأبعاد والمواصفات، ثم تستأجر مقاولاً منفصلاً للتنفيذ. التصميم والبناء (تسليم مفتاح): شركة واحدة تتولى كل شيء من المفهوم إلى المساحة المكتملة. التصميم والبناء عادةً أغلى بنسبة 10-15% لكنه يوفر مسؤولية واحدة وجداول زمنية أسرع ومراقبة جودة أفضل. معظم أصحاب المنازل في الإمارات يفضلون التصميم والبناء للراحة.' },
      },
      {
        q: { en: 'What services does Tarmeer offer for new home design?', ar: 'ما هي خدمات تعمير لتصميم المنازل الجديدة؟' },
        a: { en: 'Tarmeer offers three core design packages: 1) New Home Design — floor plans, 3D renderings, construction drawings, and full material specifications for new builds. 2) Soft Decoration — furniture selection, color schemes, lighting plans, and styling for move-in ready spaces. 3) House Exterior Design — facade concepts, material selection, and construction-ready exterior documentation. Each package includes consultation, visualization, and documentation delivery.', ar: 'تقدم تعمير ثلاث حزم تصميم أساسية: 1) تصميم المنزل الجديد — مخططات الطوابق، تصورات ثلاثية الأبعاد، رسومات البناء، ومواصفات المواد الكاملة للبناء الجديد. 2) الديكور الناعم — اختيار الأثاث، مخططات الألوان، خطط الإضاءة، والتنسيق للمساحات الجاهزة للسكن. 3) تصميم واجهات المنازل — مفاهيم الواجهات، اختيار المواد، ووثائق خارجية جاهزة للبناء. كل حزمة تتضمن استشارة وتصوراً وتسليم الوثائق.' },
      },
      {
        q: { en: 'How do I get started with a renovation project?', ar: 'كيف أبدأ مشروع تجديد؟' },
        a: { en: 'Start by: 1) Defining your budget range, 2) Collecting inspiration images (Pinterest, Instagram, or browse Tarmeer portfolios), 3) Listing your must-haves vs nice-to-haves, 4) Browsing companies on Tarmeer filtered by your city, style preference, and budget, 5) Contacting 2-3 companies for initial consultations (most offer free first meetings), 6) Comparing proposals and portfolios before committing. Tarmeer makes step 4 easy with detailed company profiles and verified project galleries.', ar: 'ابدأ بـ: 1) تحديد نطاق ميزانيتك، 2) جمع صور إلهام (بينترست، إنستغرام، أو تصفح معارض تعمير)، 3) إعداد قائمة بالأولويات مقابل الرغبات، 4) تصفح الشركات على تعمير مصفاة حسب مدينتك وتفضيل الأسلوب والميزانية، 5) التواصل مع 2-3 شركات للاستشارات الأولية (معظمها تقدم لقاءات أولى مجانية)، 6) مقارنة العروض والمعارض قبل الالتزام. تعمير يسهل الخطوة 4 مع ملفات تعريف الشركات التفصيلية ومعارض المشاريع الموثقة.' },
      },
    ],
  },
];

export default function FaqPage() {
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const isRtl = lang === 'ar';

  const toggleItem = (key: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Build JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_DATA.flatMap(cat =>
      cat.items.map(item => ({
        '@type': 'Question',
        name: item.q.en,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a.en,
        },
      }))
    ),
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      <Helmet>
        <title>FAQ - Interior Design Questions & Answers | Tarmeer</title>
        <meta name="description" content="Frequently asked questions about interior design in the UAE. Learn about design costs, renovation timelines, company selection, popular styles, and how Tarmeer helps you find the right design company." />
        <meta property="og:title" content="FAQ - Interior Design Questions & Answers | Tarmeer" />
        <meta property="og:description" content="Answers to common questions about interior design companies, costs, styles, and renovation services in the UAE." />
        <meta property="og:image" content="https://www.tarmeer.com/og-default.jpg" />
        <meta property="og:url" content="https://www.tarmeer.com/faq" />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://www.tarmeer.com/faq" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="FAQ - Interior Design Questions & Answers | Tarmeer" />
        <meta name="twitter:description" content="Answers to common questions about interior design in the UAE." />
        <meta name="twitter:image" content="https://www.tarmeer.com/og-default.jpg" />
        <meta name="keywords" content="interior design FAQ, UAE renovation questions, Dubai design cost, interior design companies UAE, home renovation process, design styles UAE, Tarmeer" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="min-h-screen bg-[var(--color-tarmeer-bg)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          {/* Header with language toggle */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-xl font-bold text-[var(--color-tarmeer-text)]">
              {lang === 'en' ? 'Frequently Asked Questions' : 'الأسئلة الشائعة'}
            </h1>
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="px-4 py-2 rounded-2xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition"
            >
              {lang === 'en' ? 'العربية' : 'English'}
            </button>
          </div>

          {/* FAQ Categories */}
          {FAQ_DATA.map((cat, ci) => (
            <section key={ci} className="mb-10">
              <h2 className="text-lg font-semibold text-[var(--color-tarmeer-text)] mb-4">
                {cat.title[lang]}
              </h2>
              <div className="space-y-3">
                {cat.items.map((item, ii) => {
                  const key = `${ci}-${ii}`;
                  const isOpen = openItems.has(key);
                  return (
                    <div key={key} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                      <button
                        onClick={() => toggleItem(key)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left"
                      >
                        <span className="text-[15px] font-medium text-[var(--color-tarmeer-text)] pr-4">
                          {item.q[lang]}
                        </span>
                        <ChevronDown className={`w-5 h-5 text-stone-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4">
                          <p className="text-[15px] text-[var(--color-tarmeer-muted)] leading-relaxed">
                            {item.a[lang]}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/pages/FaqPage.tsx
git commit -m "feat(geo): add FAQ page with EN/AR bilingual content, language toggle, FAQPage JSON-LD"
```

---

### Task 7: Wire FAQ route + footer link

**Files:**
- Modify: `src/App.tsx:13` (add lazy import)
- Modify: `src/App.tsx:170` (add route)
- Modify: `src/components/Footer.tsx:6-13` (add FAQ to nav links)

**Step 1: Add lazy import in App.tsx**

After line 31 (`const PortfolioPage = ...`), add:

```tsx
const FaqPage = lazy(() => import('./pages/FaqPage'));
```

**Step 2: Add route in App.tsx**

After line 170 (`<Route path="/portfolio" ...>`), add:

```tsx
<Route path="/faq" element={<FaqPage />} />
```

**Step 3: Add FAQ to footer nav links**

In `src/components/Footer.tsx`, add to `footerNavLinks` array (after line 12):

```ts
{ to: '/faq', label: 'FAQ' },
```

**Step 4: Verify the route works**

Run: `npm run dev`
Navigate to: `http://localhost:5173/faq`
Expected: FAQ page renders with 3 categories, language toggle works

**Step 5: Commit**

```bash
git add src/App.tsx src/components/Footer.tsx
git commit -m "feat(geo): wire FAQ route in App.tsx + add FAQ link to footer"
```

---

### Task 8: Register FAQ in SEO linter

**Files:**
- Modify: `scripts/harness/lint-seo.mjs:29-39` (add FaqPage to PUBLIC_PAGES)

**Step 1: Add FaqPage to PUBLIC_PAGES array**

After the MaterialCategoryPage entry, add:

```js
{ file: 'src/pages/FaqPage.tsx', label: 'FAQ', detail: false },
```

**Step 2: Run the linter to verify**

Run: `node scripts/harness/lint-seo.mjs`
Expected: All pages pass (10 pages including FaqPage)

**Step 3: Commit**

```bash
git add scripts/harness/lint-seo.mjs
git commit -m "feat(geo): register FaqPage in SEO linter"
```

---

### Task 9: HomePage — add WebSite + Organization JSON-LD

**Files:**
- Modify: `src/pages/HomePage.tsx` (add JSON-LD inside Helmet)

**Step 1: Add JSON-LD schemas inside the existing Helmet block**

Add before the closing `</Helmet>` tag:

```tsx
<script type="application/ld+json">{JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Tarmeer',
  url: 'https://www.tarmeer.com',
  description: 'Find and compare interior design and renovation companies across the UAE.',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://www.tarmeer.com/companies?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
})}</script>
<script type="application/ld+json">{JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Tarmeer',
  url: 'https://www.tarmeer.com',
  logo: 'https://www.tarmeer.com/logo.png',
  description: 'UAE interior design platform connecting homeowners with verified design companies. Serving 50+ companies across Dubai, Abu Dhabi, Sharjah, and other emirates.',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Industrial Area 2',
    addressLocality: 'Sharjah',
    addressCountry: 'AE',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+971-58-838-8922',
    contactType: 'customer service',
    availableLanguage: ['English', 'Arabic'],
  },
  sameAs: ['https://www.instagram.com/tarmeer.ae/'],
  areaServed: {
    '@type': 'Country',
    name: 'United Arab Emirates',
  },
})}</script>
```

**Step 2: Run SEO linter**

Run: `node scripts/harness/lint-seo.mjs`
Expected: All pages pass

**Step 3: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat(geo): add WebSite + Organization JSON-LD to HomePage"
```

---

### Task 10: CompaniesPage — add ItemList JSON-LD

**Files:**
- Modify: `src/pages/CompaniesPage.tsx` (add ItemList JSON-LD inside Helmet)

**Step 1: Add dynamic ItemList JSON-LD**

Inside the Helmet block (after line 316), add a JSON-LD script that maps the `companies` state to an ItemList. Place this logic before the return statement where companies data is available:

```tsx
const companiesJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Interior Design Companies in UAE',
  description: 'Verified interior design and renovation companies across the United Arab Emirates.',
  numberOfItems: companies.length,
  itemListElement: companies.slice(0, 30).map((c: any, i: number) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'LocalBusiness',
      name: c.name,
      url: `https://www.tarmeer.com/companies/${c.slug || c.id}`,
      ...(c.city && { address: { '@type': 'PostalAddress', addressLocality: c.city, addressCountry: 'AE' } }),
    },
  })),
};
```

Then inside Helmet:
```tsx
<script type="application/ld+json">{JSON.stringify(companiesJsonLd)}</script>
```

**Step 2: Commit**

```bash
git add src/pages/CompaniesPage.tsx
git commit -m "feat(geo): add ItemList JSON-LD to CompaniesPage"
```

---

### Task 11: ContactPage — add ContactPage + Organization JSON-LD

**Files:**
- Modify: `src/pages/ContactPage.tsx` (add JSON-LD inside Helmet)

**Step 1: Add JSON-LD inside existing Helmet block**

```tsx
<script type="application/ld+json">{JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: 'Contact Tarmeer',
  url: 'https://www.tarmeer.com/contact',
  mainEntity: {
    '@type': 'Organization',
    name: 'Tarmeer',
    url: 'https://www.tarmeer.com',
    telephone: '+971-58-838-8922',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Industrial Area 2',
      addressLocality: 'Sharjah',
      addressCountry: 'AE',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+971-58-838-8922',
      contactType: 'customer service',
      availableLanguage: ['English', 'Arabic'],
    },
  },
})}</script>
```

**Step 2: Commit**

```bash
git add src/pages/ContactPage.tsx
git commit -m "feat(geo): add ContactPage + Organization JSON-LD to ContactPage"
```

---

### Task 12: ShowroomsPage — add ItemList JSON-LD

**Files:**
- Modify: `src/pages/ShowroomsPage.tsx` (add JSON-LD inside Helmet)

**Step 1: Add static ItemList JSON-LD for showroom locations**

Inside the existing Helmet block:

```tsx
<script type="application/ld+json">{JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Showrooms & Building Materials in UAE',
  description: 'Partner showrooms and building material brands available through Tarmeer in the UAE.',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      item: {
        '@type': 'Store',
        name: 'Tarmeer Showroom - Sharjah',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Industrial Area 2',
          addressLocality: 'Sharjah',
          addressCountry: 'AE',
        },
      },
    },
  ],
})}</script>
```

**Step 2: Commit**

```bash
git add src/pages/ShowroomsPage.tsx
git commit -m "feat(geo): add ItemList JSON-LD to ShowroomsPage"
```

---

### Task 13: Service pages — add Service JSON-LD

**Files:**
- Modify: `src/pages/NewHomeDesignPage.tsx` (add Helmet + Service JSON-LD)
- Modify: `src/pages/SoftDecorationPage.tsx` (add Service JSON-LD)
- Modify: `src/pages/HouseExteriorDesignPage.tsx` (add Service JSON-LD)

**Step 1: Add Helmet + Service schema to NewHomeDesignPage**

This page is MISSING Helmet entirely. Add import and full Helmet block at top of the return JSX:

```tsx
import { Helmet } from 'react-helmet-async';
```

Inside the component, before the first `<section>`:

```tsx
<Helmet>
  <title>New Home Design Service - Floor Plans & 3D Renderings | Tarmeer</title>
  <meta name="description" content="Professional new home interior design service in the UAE. Get floor plans, 3D renderings, construction drawings, and full material specifications. Starting from AED 2,999." />
  <meta property="og:title" content="New Home Design Service | Tarmeer" />
  <meta property="og:description" content="Floor plans, 3D renderings, and construction drawings for your new home in the UAE." />
  <meta property="og:image" content="https://www.tarmeer.com/og-default.jpg" />
  <link rel="canonical" href="https://www.tarmeer.com/services/new-home-design" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="keywords" content="new home design UAE, interior design service, floor plan, 3D rendering, construction drawings, Tarmeer" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <script type="application/ld+json">{JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'New Home Interior Design',
    description: 'Complete interior design package for new homes including floor plans, 3D renderings, construction drawings, and material specifications.',
    provider: { '@type': 'Organization', name: 'Tarmeer', url: 'https://www.tarmeer.com' },
    areaServed: { '@type': 'Country', name: 'United Arab Emirates' },
    serviceType: 'Interior Design',
    url: 'https://www.tarmeer.com/services/new-home-design',
  })}</script>
</Helmet>
```

**Step 2: Add Service JSON-LD to SoftDecorationPage and HouseExteriorDesignPage**

Same pattern — add `<script type="application/ld+json">` inside existing Helmet (or add Helmet if missing), with:
- SoftDecorationPage: `serviceType: 'Soft Decoration'`, `name: 'Soft Decoration & Furniture Design'`
- HouseExteriorDesignPage: `serviceType: 'Exterior Design'`, `name: 'House Exterior Design'`

**Step 3: Commit**

```bash
git add src/pages/NewHomeDesignPage.tsx src/pages/SoftDecorationPage.tsx src/pages/HouseExteriorDesignPage.tsx
git commit -m "feat(geo): add Helmet + Service JSON-LD to all 3 service pages"
```

---

### Task 14: Enhance dynamic sitemap

**Files:**
- Modify: `server/src/app.ts:159-211` (enhance existing `/api/sitemap.xml` endpoint)

**Step 1: Enhance the sitemap to include projects, brands, and FAQ**

Replace the existing `/api/sitemap.xml` handler (lines 160-211) with:

```ts
app.get('/api/sitemap.xml', async (req, res) => {
  try {
    const pool = (await import('./config/database')).default;

    const [uaeCompanies] = await pool.execute(
      'SELECT slug, updated_at FROM uae_companies WHERE slug IS NOT NULL ORDER BY weight_score DESC'
    );
    const [profiles] = await pool.execute(
      'SELECT slug, updated_at FROM company_profiles WHERE status = ? AND slug IS NOT NULL AND deleted_at IS NULL ORDER BY weight_score DESC',
      ['approved']
    );
    // Get projects with their company slugs
    const [projects] = await pool.execute(
      `SELECT p.slug AS project_slug, p.updated_at,
              COALESCE(cp.slug, uc.slug) AS company_slug
       FROM projects p
       LEFT JOIN company_profiles cp ON p.company_id = cp.id AND cp.deleted_at IS NULL
       LEFT JOIN uae_companies uc ON p.uae_company_id = uc.id
       WHERE p.slug IS NOT NULL AND p.deleted_at IS NULL
       ORDER BY p.updated_at DESC`
    );

    const baseUrl = 'https://www.tarmeer.com';
    const today = new Date().toISOString().slice(0, 10);

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages
    const staticPages = [
      { path: '', changefreq: 'daily', priority: '1.0' },
      { path: '/companies', changefreq: 'daily', priority: '0.9' },
      { path: '/portfolio', changefreq: 'daily', priority: '0.9' },
      { path: '/faq', changefreq: 'weekly', priority: '0.7' },
      { path: '/contact', changefreq: 'weekly', priority: '0.7' },
      { path: '/materials', changefreq: 'weekly', priority: '0.8' },
      { path: '/services/new-home-design', changefreq: 'weekly', priority: '0.8' },
      { path: '/services/soft-decoration', changefreq: 'weekly', priority: '0.8' },
      { path: '/services/house-exterior', changefreq: 'weekly', priority: '0.8' },
      { path: '/privacy', changefreq: 'monthly', priority: '0.4' },
    ];
    for (const page of staticPages) {
      xml += `  <url><loc>${baseUrl}${page.path}</loc><changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority><lastmod>${today}</lastmod></url>\n`;
    }

    // Company pages
    const allCompanies = [...(uaeCompanies as any[]), ...(profiles as any[])];
    for (const company of allCompanies) {
      if (company.slug) {
        const lastmod = company.updated_at ? new Date(company.updated_at).toISOString().slice(0, 10) : today;
        xml += `  <url><loc>${baseUrl}/companies/${company.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${lastmod}</lastmod></url>\n`;
      }
    }

    // Project pages
    for (const project of projects as any[]) {
      if (project.company_slug && project.project_slug) {
        const lastmod = project.updated_at ? new Date(project.updated_at).toISOString().slice(0, 10) : today;
        xml += `  <url><loc>${baseUrl}/companies/${project.company_slug}/${project.project_slug}</loc><changefreq>monthly</changefreq><priority>0.7</priority><lastmod>${lastmod}</lastmod></url>\n`;
      }
    }

    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (error) {
    console.error('Sitemap error:', error);
    res.status(500).send('Error generating sitemap');
  }
});
```

**Step 2: Commit**

```bash
git add server/src/app.ts
git commit -m "feat(geo): enhance dynamic sitemap with projects, FAQ, service pages, lastmod timestamps"
```

---

### Task 15: Update static sitemap + robots.txt

**Files:**
- Modify: `public/sitemap.xml` (convert to sitemap index)
- Modify: `public/robots.txt` (add AI crawler rules)

**Step 1: Replace static sitemap with sitemap index**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.tarmeer.com/api/sitemap.xml</loc>
  </sitemap>
</sitemapindex>
```

**Step 2: Update robots.txt with AI crawler rules**

```
User-agent: Googlebot
Allow: /
Crawl-delay: 2

User-agent: Bingbot
Allow: /
Crawl-delay: 5

User-agent: GPTBot
Allow: /
Crawl-delay: 5

User-agent: ChatGPT-User
Allow: /
Crawl-delay: 5

User-agent: PerplexityBot
Allow: /
Crawl-delay: 5

User-agent: ClaudeBot
Allow: /
Crawl-delay: 5

User-agent: Applebot
Allow: /
Crawl-delay: 5

User-agent: *
Allow: /
Disallow: /api/
Allow: /api/sitemap.xml
Disallow: /admin/
Crawl-delay: 10

Sitemap: https://www.tarmeer.com/sitemap.xml
Sitemap: https://www.tarmeer.com/api/sitemap.xml
```

**Step 3: Commit**

```bash
git add public/sitemap.xml public/robots.txt
git commit -m "feat(geo): convert sitemap to index, add AI crawler rules to robots.txt"
```

---

### Task 16: Update docs/SEO.md with GEO additions

**Files:**
- Modify: `docs/SEO.md` (add FAQ page to table, document GEO schemas, reference prerender)

**Step 1: Update SEO.md**

Add to the public pages table:
```
| FAQ | `FaqPage.tsx` | `/faq` | No | FAQPage |
```

Add a new section "GEO (Generative Engine Optimization)":
- Document prerender service architecture
- List all JSON-LD schemas added (WebSite, Organization, Service, ContactPage, FAQPage, ItemList)
- Reference `server/prerender/` for prerender config
- Reference `server/prerender/ops/` for watchdog config
- Document AI crawler User-Agent list

**Step 2: Commit**

```bash
git add docs/SEO.md
git commit -m "docs(geo): update SEO.md with GEO section, FAQ page, and new schemas"
```

---

## Execution Summary

| Task | Description | Est. Files |
|------|-------------|-----------|
| 1 | Prerender scaffolding (package.json, pm2) | 2 new |
| 2 | Prerender service (index.js) | 1 new |
| 3 | nginx config reference | 1 new |
| 4 | Watchdog config + requirements | 2 new |
| 5 | Watchdog Python script | 2 new |
| 6 | FAQ page (FaqPage.tsx) | 1 new |
| 7 | Wire FAQ route + footer link | 2 modified |
| 8 | Register FAQ in SEO linter | 1 modified |
| 9 | HomePage JSON-LD | 1 modified |
| 10 | CompaniesPage JSON-LD | 1 modified |
| 11 | ContactPage JSON-LD | 1 modified |
| 12 | ShowroomsPage JSON-LD | 1 modified |
| 13 | Service pages JSON-LD (×3) | 3 modified |
| 14 | Enhanced dynamic sitemap | 1 modified |
| 15 | Static sitemap + robots.txt | 2 modified |
| 16 | Update docs/SEO.md | 1 modified |

**Total: 9 new files, 13 modified files, 16 commits**
