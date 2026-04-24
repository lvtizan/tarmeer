#!/usr/bin/env python3
"""
Tarmeer Daily Stats Collector
------------------------------
Runs nightly at 02:00 AM Dubai time (22:00 UTC previous day).
Collects key metrics from the RDS MySQL database and writes them
into the daily_stats table.

Setup on server:
  pip3 install mysql-connector-python python-dotenv

Cron entry (server crontab, UTC time):
  0 22 * * * /usr/bin/python3 /tarmeer/tarmeer_api/scripts/collect_daily_stats.py >> /tarmeer/logs/daily_stats.log 2>&1

Or using Dubai timezone explicitly:
  0 2 * * * TZ=Asia/Dubai /usr/bin/python3 /tarmeer/tarmeer_api/scripts/collect_daily_stats.py >> /tarmeer/logs/daily_stats.log 2>&1
"""

import os
import sys
import datetime
from pathlib import Path

# Load .env from the API root (parent of scripts/)
script_dir = Path(__file__).resolve().parent
api_root = script_dir.parent.parent  # /tarmeer/tarmeer_api

env_file = api_root / '.env'
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, val = line.partition('=')
                os.environ.setdefault(key.strip(), val.strip())

try:
    import mysql.connector
except ImportError:
    print("ERROR: mysql-connector-python not installed. Run: pip3 install mysql-connector-python")
    sys.exit(1)

DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': int(os.environ.get('DB_PORT', '3306')),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', ''),
    'database': os.environ.get('DB_NAME', 'tarmeer'),
    'charset': 'utf8mb4',
}

# Collect stats for yesterday (cron runs at 02:00 AM Dubai = after midnight, so yesterday is complete)
dubai_now = datetime.datetime.utcnow() + datetime.timedelta(hours=4)
stat_date = (dubai_now - datetime.timedelta(days=1)).date()

print(f"[{datetime.datetime.utcnow().isoformat()}] Collecting stats for {stat_date} (Dubai: {dubai_now.date()})")

METRICS = [
    # (metric_name, SQL query that returns a single integer for stat_date)
    (
        'new_homeowners',
        """SELECT COUNT(*) FROM users
           WHERE DATE(created_at) = %s AND deleted_at IS NULL"""
    ),
    (
        'new_companies',
        """SELECT COUNT(*) FROM company_profiles
           WHERE DATE(created_at) = %s AND deleted_at IS NULL"""
    ),
    (
        'new_inquiries',
        """SELECT COUNT(*) FROM inquiries
           WHERE DATE(created_at) = %s"""
    ),
    (
        'total_approved_companies',
        """SELECT COUNT(*) FROM company_profiles
           WHERE status = 'approved' AND deleted_at IS NULL
           AND DATE(created_at) <= %s"""
    ),
    (
        'total_homeowners',
        """SELECT COUNT(*) FROM users
           WHERE deleted_at IS NULL AND DATE(created_at) <= %s"""
    ),
]

try:
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()

    for metric, query in METRICS:
        cursor.execute(query, (str(stat_date),))
        row = cursor.fetchone()
        value = int(row[0]) if row else 0

        # Upsert into daily_stats
        cursor.execute(
            """INSERT INTO daily_stats (stat_date, metric, value)
               VALUES (%s, %s, %s)
               ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()""",
            (str(stat_date), metric, value)
        )
        print(f"  {metric}: {value}")

    conn.commit()
    cursor.close()
    conn.close()
    print(f"[{datetime.datetime.utcnow().isoformat()}] Done. Stats written for {stat_date}.")

except mysql.connector.Error as e:
    print(f"ERROR: MySQL connection failed: {e}")
    sys.exit(1)
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
