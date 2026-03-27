import { Response, Request } from 'express';
import pool from '../config/database';
import { ensureAnalyticsEventsTable } from '../lib/analyticsEventStore';

interface AnalyticsQueryParams {
  endDate?: string;
  startDate?: string;
}

interface AnalyticsEventsQueryParams {
  page?: string;
  limit?: string;
  eventName?: string;
  pagePath?: string;
}

function toDateString(input: unknown): string {
  if (typeof input !== 'string') return '';
  const value = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  return value;
}

export async function getAnalyticsOverview(req: Request<{}, {}, {}, AnalyticsQueryParams>, res: Response): Promise<void> {
  const end = toDateString(req.query.endDate) || new Date().toISOString().slice(0, 10);
  const start = toDateString(req.query.startDate) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    await ensureAnalyticsEventsTable();

    const [overviewRows] = await pool.execute(
      `SELECT
        COUNT(*) AS total_events,
        COUNT(DISTINCT CASE
          WHEN viewer_ip IS NOT NULL
           AND viewer_ip <> ''
           AND viewer_ip <> 'unknown'
           AND viewer_ip <> '127.0.0.1'
           AND viewer_ip <> '::1'
           AND viewer_ip <> '::ffff:127.0.0.1'
          THEN viewer_ip
        END) AS unique_visitors,
        SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END) AS page_views,
        SUM(CASE WHEN event_name = 'apply_click' THEN 1 ELSE 0 END) AS apply_clicks,
        SUM(CASE WHEN event_name = 'click_whatsapp' THEN 1 ELSE 0 END) AS whatsapp_clicks,
        SUM(CASE WHEN event_name = 'submit_contact_form' THEN 1 ELSE 0 END) AS contact_submits
       FROM analytics_events
       WHERE DATE(created_at) BETWEEN ? AND ?`,
      [start, end]
    );

    const [topPagesRows] = await pool.execute(
      `SELECT
        page_path,
        COUNT(*) AS page_views,
        COUNT(DISTINCT CASE
          WHEN viewer_ip IS NOT NULL
           AND viewer_ip <> ''
           AND viewer_ip <> 'unknown'
           AND viewer_ip <> '127.0.0.1'
           AND viewer_ip <> '::1'
           AND viewer_ip <> '::ffff:127.0.0.1'
          THEN viewer_ip
        END) AS visitors
       FROM analytics_events
       WHERE DATE(created_at) BETWEEN ? AND ?
         AND event_name = 'page_view'
         AND page_path IS NOT NULL
         AND page_path <> ''
       GROUP BY page_path
       ORDER BY visitors DESC, page_views DESC
       LIMIT 10`,
      [start, end]
    );

    res.json({
      overview: (overviewRows as any[])[0] || {
        total_events: 0,
        unique_visitors: 0,
        page_views: 0,
        apply_clicks: 0,
        whatsapp_clicks: 0,
        contact_submits: 0,
      },
      topPages: topPagesRows,
      dateRange: { start, end },
    });
  } catch (error) {
    console.error('Error getting analytics overview:', error);
    res.status(500).json({ error: 'Failed to get analytics overview.' });
  }
}

export async function listAnalyticsEvents(req: Request<{}, {}, {}, AnalyticsEventsQueryParams>, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
  const offset = (page - 1) * limit;
  const eventName = typeof req.query.eventName === 'string' ? req.query.eventName.trim() : '';
  const pagePath = typeof req.query.pagePath === 'string' ? req.query.pagePath.trim() : '';

  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (eventName) {
    conditions.push('event_name = ?');
    params.push(eventName);
  }

  if (pagePath) {
    conditions.push('page_path LIKE ?');
    params.push(`%${pagePath}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    await ensureAnalyticsEventsTable();

    const [rows] = await pool.execute(
      `SELECT
        id,
        event_name,
        page_path,
        viewer_ip,
        location_label,
        referrer,
        user_agent,
        payload,
        created_at
       FROM analytics_events
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM analytics_events
       ${whereClause}`,
      params
    );

    const total = Number((countRows as any[])[0]?.total || 0);

    res.json({
      events: rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing analytics events:', error);
    res.status(500).json({ error: 'Failed to list analytics events.' });
  }
}
