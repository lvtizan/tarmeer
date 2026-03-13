import pool from '../config/database';
import {
  sanitizePublicDesigner,
  sanitizePublicProject,
} from '../lib/publicDesignerSerialization';
import { buildPublicDesignersListQuery } from '../lib/publicDesignersQuery';
import { parseJsonField } from '../lib/parseJsonField';

function normalizeCity(city?: string | null): string | null {
  if (!city) return null;
  return city
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function sanitizePrivateDesigner(designer: any) {
  return {
    id: designer.id,
    email: designer.email,
    full_name: designer.full_name,
    title: designer.title || '',
    phone: designer.phone,
    city: designer.city,
    address: designer.address,
    bio: designer.bio,
    avatar_url: designer.avatar_url,
    style: designer.style,
    expertise: parseJsonField(designer.expertise) || [],
    status: designer.status,
    is_approved: designer.is_approved,
    email_verified: designer.email_verified,
    display_order: designer.display_order,
    created_at: designer.created_at,
    updated_at: designer.updated_at,
  };
}

export async function getDesigners(req: any, res: any) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const whereClause = `WHERE status = 'approved' AND is_approved = 1`;
    const params: any[] = [];
    
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM designers ${whereClause}`,
      params
    );
    
    const total = (countResult as any[])[0].total;
    
    const listQuery = buildPublicDesignersListQuery({
      limit,
      offset,
    });

    const [designers] = await pool.execute(listQuery.sql, listQuery.params);
    
    res.json({
      designers: (designers as any[]).map(sanitizePublicDesigner),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get designers error:', error);
    res.status(500).json({ error: 'Failed to load designers.' });
  }
}

export async function getDesignerById(req: any, res: any) {
  try {
    const { id } = req.params;
    
    const [designer] = await pool.execute(
      `SELECT
         id,
         full_name,
         title,
         city,
         bio,
         avatar_url,
         style,
         expertise,
         display_order,
         created_at,
         (SELECT COUNT(*) FROM projects p WHERE p.designer_id = designers.id AND p.status = 'published') as project_count,
         (SELECT images FROM projects p WHERE p.designer_id = designers.id AND p.status = 'published' ORDER BY p.created_at DESC LIMIT 1) as featured_project_images
       FROM designers WHERE id = ? AND status = 'approved' AND is_approved = 1`,
      [id]
    );
    
    if ((designer as any[]).length === 0) {
      return res.status(404).json({ error: 'Designer not found.' });
    }
    
    const [projects] = await pool.execute(
      `SELECT id, title, description, style, location, area, year, cost, images, tags, status, created_at 
       FROM projects WHERE designer_id = ? AND status = 'published' 
       ORDER BY created_at DESC`,
      [id]
    );
    
    const designerRecord = (designer as any[])[0];

    res.json({
      designer: sanitizePublicDesigner(designerRecord),
      projects: (projects as any[]).map((project) =>
        sanitizePublicProject({
          ...project,
          designer_name: designerRecord.full_name,
          designer_city: designerRecord.city,
          designer_avatar: designerRecord.avatar_url,
          designer_bio: designerRecord.bio,
        })
      )
    });
  } catch (error) {
    console.error('Get designer error:', error);
    res.status(500).json({ error: 'Failed to load designer.' });
  }
}

export async function updateDesigner(req: any, res: any) {
  try {
    const { id } = req.params;
    const { full_name, title, phone, city, address, bio, avatar_url, style, expertise } = req.body;
    
    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'You cannot edit another designer\'s profile.' });
    }

    const [existingRows] = await pool.execute(
      'SELECT * FROM designers WHERE id = ?',
      [id]
    );

    if ((existingRows as any[]).length === 0) {
      return res.status(404).json({ error: 'Designer not found.' });
    }

    const existing = (existingRows as any[])[0];
    
    await pool.execute(
      `UPDATE designers 
       SET full_name = ?, title = ?, phone = ?, city = ?, address = ?, bio = ?, avatar_url = ?, style = ?, expertise = ?
       WHERE id = ?`,
      [
        full_name ?? existing.full_name,
        title ?? existing.title,
        phone ?? existing.phone,
        normalizeCity(city) ?? existing.city,
        address ?? existing.address,
        bio ?? existing.bio,
        avatar_url ?? existing.avatar_url,
        style ?? existing.style,
        JSON.stringify(expertise ?? parseJsonField(existing.expertise) ?? []),
        id,
      ]
    );
    
    const [designer] = await pool.execute(
      'SELECT * FROM designers WHERE id = ?',
      [id]
    );
    
    res.json({
      message: 'Updated successfully.',
      designer: sanitizePrivateDesigner((designer as any[])[0])
    });
  } catch (error) {
    console.error('Update designer error:', error);
    res.status(500).json({ error: 'Failed to update designer.' });
  }
}
