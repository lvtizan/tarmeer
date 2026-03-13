import { Request, Response } from 'express';
import pool from '../config/database';

// Get client IP
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

// Record page view
export async function recordPageView(req: Request, res: Response) {
  const { entityType, entityId, referrer } = req.body;
  
  if (!entityType || !entityId) {
    return res.status(400).json({ error: 'entityType and entityId are required.' });
  }
  
  if (!['designer', 'project'].includes(entityType)) {
    return res.status(400).json({ error: 'entityType must be "designer" or "project".' });
  }
  
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const fingerprint = req.body.fingerprint || null;
    
    // Insert raw page view (for detailed analytics)
    await pool.execute(
      `INSERT INTO page_views (entity_type, entity_id, viewer_ip, viewer_fingerprint, referrer, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [entityType, entityId, ip, fingerprint, referrer || null, userAgent.substring(0, 512)]
    );
    
    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    const column = entityType === 'designer' ? 'profile_views' : 'project_views';
    
    // For designer views, also update designer_stats
    if (entityType === 'designer') {
      await pool.execute(
        `INSERT INTO designer_stats (designer_id, stat_date, profile_views)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE profile_views = profile_views + 1`,
        [entityId, today]
      );
    } else {
      // For project views, need to find the designer and update their project_views
      const [projectRows] = await pool.execute(
        'SELECT designer_id FROM projects WHERE id = ?',
        [entityId]
      );
      
      const projects = projectRows as any[];
      if (projects.length > 0) {
        const designerId = projects[0].designer_id;
        await pool.execute(
          `INSERT INTO designer_stats (designer_id, stat_date, project_views)
           VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE project_views = project_views + 1`,
          [designerId, today]
        );
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error recording page view:', error);
    res.status(500).json({ error: 'Failed to record page view.' });
  }
}

// Valid column names for stats (whitelist)
const STATS_COLUMNS = ['phone_clicks', 'whatsapp_clicks', 'contact_clicks', 'project_views', 'profile_views'] as const;
type StatsColumn = typeof STATS_COLUMNS[number];

// Record click event
export async function recordClick(req: Request, res: Response) {
  const { designerId, clickType } = req.body;
  
  if (!designerId || !clickType) {
    return res.status(400).json({ error: 'designerId and clickType are required.' });
  }
  
  // Whitelist for clickType
  const columnMap: Record<string, StatsColumn> = {
    phone: 'phone_clicks',
    whatsapp: 'whatsapp_clicks',
    email: 'contact_clicks',
    contact_form: 'contact_clicks'
  };
  
  const column = columnMap[clickType];
  if (!column) {
    return res.status(400).json({ error: 'Invalid clickType.' });
  }
  
  try {
    const ip = getClientIp(req);
    const today = new Date().toISOString().split('T')[0];
    
    // Insert click event
    await pool.execute(
      `INSERT INTO click_events (designer_id, click_type, viewer_ip)
       VALUES (?, ?, ?)`,
      [designerId, clickType, ip]
    );
    
    // Update daily stats with safe column name (using whitelist)
    await pool.execute(
      `INSERT INTO designer_stats (designer_id, stat_date, ${column})
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE ${column} = ${column} + 1`,
      [designerId, today]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error recording click:', error);
    res.status(500).json({ error: 'Failed to record click.' });
  }
}

// Batch record events (for client-side batching)
export async function batchRecord(req: Request, res: Response) {
  const { events } = req.body;
  
  if (!events || !Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'events array is required.' });
  }
  
  // Limit batch size
  const MAX_BATCH_SIZE = 100;
  if (events.length > MAX_BATCH_SIZE) {
    return res.status(400).json({ error: `Maximum ${MAX_BATCH_SIZE} events per batch.` });
  }
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent']?.substring(0, 512) || '';
    
    for (const event of events) {
      if (event.type === 'page_view') {
        const { entityType, entityId, referrer, fingerprint } = event;
        
        if (entityType && entityId && ['designer', 'project'].includes(entityType)) {
          await pool.execute(
            `INSERT INTO page_views (entity_type, entity_id, viewer_ip, viewer_fingerprint, referrer, user_agent)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [entityType, entityId, ip, fingerprint || null, referrer || null, userAgent]
          );
          
          if (entityType === 'designer') {
            await pool.execute(
              `INSERT INTO designer_stats (designer_id, stat_date, profile_views)
               VALUES (?, ?, 1)
               ON DUPLICATE KEY UPDATE profile_views = profile_views + 1`,
              [entityId, today]
            );
          }
        }
      } else if (event.type === 'click') {
        const { designerId, clickType } = event;
        
        // Whitelist for clickType
        const columnMap: Record<string, StatsColumn> = {
          phone: 'phone_clicks',
          whatsapp: 'whatsapp_clicks',
          email: 'contact_clicks',
          contact_form: 'contact_clicks'
        };
        
        const column = columnMap[clickType];
        
        if (designerId && column) {
          await pool.execute(
            `INSERT INTO click_events (designer_id, click_type, viewer_ip)
             VALUES (?, ?, ?)`,
            [designerId, clickType, ip]
          );
          
          await pool.execute(
            `INSERT INTO designer_stats (designer_id, stat_date, ${column})
             VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE ${column} = ${column} + 1`,
            [designerId, today]
          );
        }
      }
    }
    
    res.json({ success: true, processedCount: events.length });
  } catch (error) {
    console.error('Error batch recording:', error);
    res.status(500).json({ error: 'Failed to record events.' });
  }
}

// Get public stats for a designer (limited)
export async function getDesignerPublicStats(req: Request, res: Response) {
  const { id } = req.params;
  
  try {
    const [rows] = await pool.execute(
      `SELECT 
        COALESCE(SUM(profile_views), 0) as total_views
       FROM designer_stats WHERE designer_id = ?`,
      [id]
    );
    
    res.json({
      totalViews: (rows as any[])[0].total_views
    });
  } catch (error) {
    console.error('Error getting designer stats:', error);
    res.status(500).json({ error: 'Failed to get stats.' });
  }
}
