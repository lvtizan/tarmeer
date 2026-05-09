import { Router } from 'express';
import pool from '../config/database';

const router = Router();

// Public: showcase images for auth page
router.get('/showcase-images', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT config_value FROM system_config WHERE config_key = 'showcase_images' LIMIT 1"
    ) as any[];
    if (!rows.length) return res.json({ images: [] });
    let images: string[] = [];
    try { images = JSON.parse(rows[0].config_value); } catch { /* ignore */ }
    res.json({ images: Array.isArray(images) ? images : [] });
  } catch {
    res.json({ images: [] });
  }
});

export default router;
