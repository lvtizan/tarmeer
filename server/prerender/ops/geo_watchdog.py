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

    usage = shutil.disk_usage(str(cache_dir))
    pct = (usage.used / usage.total) * 100
    threshold = int(cfg["thresholds"]["disk_warn_percent"])
    if pct > threshold:
        send_alert(cfg, f"Disk Usage Warning: {pct:.1f}%",
                   f"Disk usage on {cache_dir} is {pct:.1f}%, above {threshold}% threshold.\n"
                   f"Total: {usage.total // (1024**3)}GB, Used: {usage.used // (1024**3)}GB")


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
