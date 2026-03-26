import pool from '../config/database';

let ensureAnalyticsEventsTablePromise: Promise<void> | null = null;

export async function ensureAnalyticsEventsTable() {
  if (!ensureAnalyticsEventsTablePromise) {
    ensureAnalyticsEventsTablePromise = pool.execute(
      `CREATE TABLE IF NOT EXISTS analytics_events (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        event_name VARCHAR(64) NOT NULL,
        page_path VARCHAR(255) DEFAULT NULL,
        viewer_ip VARCHAR(64) DEFAULT NULL,
        location_label VARCHAR(255) DEFAULT NULL,
        referrer VARCHAR(512) DEFAULT NULL,
        user_agent VARCHAR(512) DEFAULT NULL,
        payload JSON DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_event_name (event_name),
        INDEX idx_created (created_at),
        INDEX idx_page_path (page_path),
        INDEX idx_viewer_ip (viewer_ip)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ).then(() => undefined);
  }

  await ensureAnalyticsEventsTablePromise;
}
