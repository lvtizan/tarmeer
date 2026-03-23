import { Response } from 'express';
import pool from '../config/database';
import { ensureVisitorLogsTable } from '../lib/visitorLogStore';
import { resolveLocationFromIp } from '../lib/ipLocation';

function isTruthyIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const normalized = ip.trim().toLowerCase();
  return normalized !== 'unknown' && normalized !== '::1' && normalized !== '127.0.0.1' && normalized !== '::ffff:127.0.0.1';
}

export async function getVisitorOverview(req: any, res: Response) {
  try {
    await ensureVisitorLogsTable();
    const [rows] = await pool.execute(
      `SELECT
        COUNT(*) AS total_visits,
        COUNT(DISTINCT CASE
          WHEN viewer_ip IS NOT NULL
           AND viewer_ip <> ''
           AND viewer_ip <> 'unknown'
           AND viewer_ip <> '127.0.0.1'
           AND viewer_ip <> '::1'
           AND viewer_ip <> '::ffff:127.0.0.1'
          THEN viewer_ip
        END) AS unique_ip_count
       FROM visitor_logs`
    );

    const overview = (rows as any[])[0] || { total_visits: 0, unique_ip_count: 0 };
    res.json({
      totalVisits: Number(overview.total_visits || 0),
      uniqueIpCount: Number(overview.unique_ip_count || 0),
    });
  } catch (error) {
    console.error('Error getting visitor overview:', error);
    res.status(500).json({ error: 'Failed to get visitor overview.' });
  }
}

export async function listVisitors(req: any, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
  const offset = (page - 1) * limit;

  try {
    await ensureVisitorLogsTable();
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
    const safeOffset = Math.max(0, Number(offset) || 0);

    const [rows] = await pool.execute(
      `SELECT
        viewer_ip AS ip,
        MAX(NULLIF(location_label, '')) AS location,
        COUNT(*) AS visit_count,
        MAX(created_at) AS last_visited_at
       FROM visitor_logs
       WHERE viewer_ip IS NOT NULL
         AND viewer_ip <> ''
       GROUP BY viewer_ip
       ORDER BY last_visited_at DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`
    );

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM (
         SELECT viewer_ip
         FROM visitor_logs
         WHERE viewer_ip IS NOT NULL
           AND viewer_ip <> ''
         GROUP BY viewer_ip
       ) ips`
    );

    const total = Number((countRows as any[])[0]?.total || 0);
    const visitors = (rows as any[]).map((row) => {
      const ip = String(row.ip || '');
      return {
        ip,
        location: (row.location as string | null) || 'Unknown',
        visitCount: Number(row.visit_count || 0),
        lastVisitedAt: row.last_visited_at,
        isPublicIp: isTruthyIp(ip),
      };
    });

    await Promise.all(
      visitors.map(async (visitor) => {
        if (visitor.location !== 'Unknown' || !visitor.isPublicIp) return;
        const resolved = await resolveLocationFromIp(visitor.ip);
        if (!resolved) return;
        visitor.location = resolved;
        await pool.execute(
          `UPDATE visitor_logs
           SET location_label = ?
           WHERE viewer_ip = ?
             AND (location_label IS NULL OR location_label = '' OR location_label = 'Unknown')`,
          [resolved, visitor.ip]
        );
      })
    );

    res.json({
      visitors,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing visitors:', error);
    res.status(500).json({ error: 'Failed to list visitors.' });
  }
}
