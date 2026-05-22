import pool from '../config/database';
import { getProjectStatusForDesignerSubmit } from '../lib/projectReview';
import { buildPublicProjectsListQuery } from '../lib/publicProjectsQuery';
import { parseJsonField } from '../lib/parseJsonField';
import { sanitizePublicProject } from '../lib/publicDesignerSerialization';
import {
  buildProjectPersistenceValues,
  PROJECT_IMAGES_REQUIRED_ERROR,
  BASE64_IMAGES_NOT_ALLOWED_ERROR,
  assertProjectHasImages,
} from '../lib/projectPersistence';
import { persistProjectImages } from '../lib/projectImageStorage';
import { slugify } from '../lib/slugify';
import { tagProjectImages } from '../services/tagEngine';
import { logActivity, getClientIp } from '../lib/activityLogger';

function normalizeProject(project: any) {
  return {
    ...project,
    images: parseJsonField(project.images) || [],
    tags: parseJsonField(project.tags) || [],
    service_tags: parseJsonField(project.service_tags) || [],
  };
}

function toSortableTimestamp(value: unknown) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value as string | number | Date).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function compareProjectsNewestFirst(left: any, right: any) {
  const updatedDiff = toSortableTimestamp(right.updated_at) - toSortableTimestamp(left.updated_at);
  if (updatedDiff !== 0) {
    return updatedDiff;
  }

  const createdDiff = toSortableTimestamp(right.created_at) - toSortableTimestamp(left.created_at);
  if (createdDiff !== 0) {
    return createdDiff;
  }

  return Number(right.id || 0) - Number(left.id || 0);
}

export async function createProject(req: any, res: any) {
  try {
    const userId = req.user.userId;
    const { title, description, style, space_type, location, area, year, cost, images, tags, service_tags, status, video_url } = req.body;
    const normalizedImages = assertProjectHasImages(images);
    const persistedImages = await persistProjectImages(normalizedImages, {
      designerId: userId,
    });
    const finalImages = assertProjectHasImages(persistedImages);
    const projectStatus = status === 'draft'
      ? getProjectStatusForDesignerSubmit(false)
      : getProjectStatusForDesignerSubmit(true);
    const values = buildProjectPersistenceValues({
      title,
      description,
      style,
      location,
      area,
      year,
      cost,
      images: finalImages,
      tags,
      service_tags,
      status: projectStatus,
    });

    // Look up company profile for this user
    const [cpRows] = await pool.execute(
      'SELECT id, status FROM company_profiles WHERE user_id = ? LIMIT 1',
      [userId]
    );
    const companyProfile = (cpRows as any[])[0] || null;
    const companyProfileId = companyProfile?.id || null;

    // If the company is already approved, auto-publish the project
    const finalStatus = companyProfile?.status === 'approved' ? 'published' : values.status;

    const [result] = await pool.execute(
      `INSERT INTO projects (designer_id, company_profile_id, title, description, style, space_type, location, area, year, cost, images, tags, service_tags, status, rejection_reason, video_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [
        null,
        companyProfileId,
        values.title,
        values.description,
        values.style,
        space_type || null,
        values.location,
        values.area,
        values.year,
        values.cost,
        values.images,
        values.tags,
        values.service_tags,
        finalStatus,
        video_url || null,
      ]
    );
    
    const projectId = (result as any).insertId;

    // Generate and save slug
    if (title) {
      const slug = slugify(title);
      await pool.execute('UPDATE projects SET slug = ? WHERE id = ?', [slug, projectId]);
    }

    const [project] = await pool.execute(
      'SELECT * FROM projects WHERE id = ?',
      [projectId]
    );
    
    // Use company profile or user info for notification
    const [cpInfo] = await pool.execute(
      'SELECT cp.company_name as full_name, u.email, cp.phone FROM company_profiles cp JOIN users u ON u.id = cp.user_id WHERE cp.user_id = ? LIMIT 1',
      [userId]
    );
    const notificationDesigner = (cpInfo as any[])[0] || { full_name: 'Unknown', email: req.user.email };

    setImmediate(() => {
      logActivity({
        userId: req.user.userId, userName: notificationDesigner.full_name || '', userRole: 'company',
        action: 'create', targetType: 'project', targetId: projectId, targetName: title || 'Untitled',
        description: `上传了项目「${title || 'Untitled'}」`,
        ip: getClientIp(req),
      }).catch(() => {});
    });

    res.status(201).json({
      message: 'Project submitted successfully.',
      project: normalizeProject((project as any[])[0])
    });

    // Fire-and-forget: AI tag images via Google Vision
    tagProjectImages(projectId).catch((err) =>
      console.error('[vision-tagging] Background tagging failed:', err)
    );
  } catch (error) {
    if (error instanceof Error && error.message === PROJECT_IMAGES_REQUIRED_ERROR) {
      return res.status(400).json({ error: 'At least one project image is required.' });
    }
    if (error instanceof Error && error.message === BASE64_IMAGES_NOT_ALLOWED_ERROR) {
      return res.status(400).json({ error: 'Image upload must be processed before submission. Please try uploading again.' });
    }
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to submit project. Please try again.' });
  }
}

export async function getProjects(req: any, res: any) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const designer_id = req.query.designer_id;
    const status = 'published';
    
    let whereClause = `WHERE p.status = ? AND cp.status = 'approved' AND cp.deleted_at IS NULL`;
    const params: any[] = [status];

    if (designer_id) {
      whereClause += ' AND p.company_profile_id = ?';
      params.push(designer_id);
    }

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total
       FROM projects p
       INNER JOIN company_profiles cp ON p.company_profile_id = cp.id
       ${whereClause}`,
      params
    );
    
    const total = (countResult as any[])[0].total;
    
    const listQuery = buildPublicProjectsListQuery({
      status,
      companyProfileId: designer_id,
      limit,
      offset,
    });

    const [projects] = await pool.execute(listQuery.sql, listQuery.params);
    
    res.json({
      projects: (projects as any[]).map((project) => sanitizePublicProject(normalizeProject(project))),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to load projects.' });
  }
}

export async function getMyProjects(req: any, res: any) {
  try {
    const userId = req.user.userId;

    const [projects] = await pool.execute(
      `SELECT id, title, description, style, location, area, year, cost, images, tags, service_tags, status, rejection_reason, created_at, updated_at
       FROM projects
       WHERE company_profile_id IN (SELECT id FROM company_profiles WHERE user_id = ?)`,
      [userId]
    );

    // Avoid sorting large JSON image payloads inside MySQL, which can exhaust sort memory.
    const normalizedProjects = (projects as any[])
      .sort(compareProjectsNewestFirst)
      .map(normalizeProject);

    res.json({ projects: normalizedProjects });
  } catch (error) {
    console.error('Get my projects error:', error);
    res.status(500).json({ error: 'Failed to load your projects.' });
  }
}

export async function getProjectById(req: any, res: any) {
  try {
    const { id } = req.params;
    
    const [project] = await pool.execute(
      `SELECT
         p.id,
         p.title,
         p.description,
         p.style,
         p.location,
         p.area,
         p.year,
         p.cost,
         p.images,
         p.tags,
         p.created_at,
         cp.company_name as designer_name,
         cp.city as designer_city, cp.logo_url as designer_avatar, cp.description as designer_bio
       FROM projects p
       INNER JOIN company_profiles cp ON p.company_profile_id = cp.id
       WHERE p.id = ? AND p.status = 'published' AND cp.status = 'approved'`,
      [id]
    );
    
    if ((project as any[]).length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    
    res.json({
      project: sanitizePublicProject(normalizeProject((project as any[])[0]))
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to load project.' });
  }
}

export async function updateProject(req: any, res: any) {
  try {
    const { id } = req.params;
    const { title, description, style, space_type, location, area, year, cost, images, tags, service_tags, status, video_url } = req.body;
    const normalizedImages = assertProjectHasImages(images);
    const persistedImages = await persistProjectImages(normalizedImages, {
      designerId: req.user.userId,
      projectId: id,
    });
    const finalImages = assertProjectHasImages(persistedImages);
    const nextStatus = status === 'draft'
      ? getProjectStatusForDesignerSubmit(false)
      : getProjectStatusForDesignerSubmit(true);
    const values = buildProjectPersistenceValues({
      title,
      description,
      style,
      location,
      area,
      year,
      cost,
      images: finalImages,
      tags,
      service_tags,
      status: nextStatus,
    });

    const [project] = await pool.execute(
      'SELECT * FROM projects WHERE id = ?',
      [id]
    );

    if ((project as any[]).length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Permission check: verify user owns this project via company_profiles
    const projectRow = (project as any[])[0];
    const [ownerCheck] = await pool.execute(
      'SELECT id FROM company_profiles WHERE id = ? AND user_id = ?',
      [projectRow.company_profile_id, req.user.userId]
    );
    if ((ownerCheck as any[]).length === 0) {
      return res.status(403).json({ error: 'You cannot edit another designer\'s project.' });
    }

    await pool.execute(
      `UPDATE projects
       SET title = ?, description = ?, style = ?, space_type = ?, location = ?, area = ?, year = ?, cost = ?, images = ?, tags = ?, service_tags = ?, status = ?, rejection_reason = NULL, video_url = ?
       WHERE id = ?`,
      [
        values.title,
        values.description,
        values.style,
        space_type || null,
        values.location,
        values.area,
        values.year,
        values.cost,
        values.images,
        values.tags,
        values.service_tags,
        values.status,
        video_url || null,
        id,
      ]
    );
    
    const [updatedProject] = await pool.execute(
      'SELECT * FROM projects WHERE id = ?',
      [id]
    );
    
    setImmediate(() => {
      logActivity({
        userId: req.user.userId, userName: null as any, userRole: 'company',
        action: 'update', targetType: 'project', targetId: Number(req.params.id), targetName: title || 'Untitled',
        description: `编辑了项目「${title || 'Untitled'}」`,
        ip: getClientIp(req),
      }).catch(() => {});
    });

    res.json({
      message: 'Updated successfully.',
      project: normalizeProject((updatedProject as any[])[0])
    });

    // Fire-and-forget: AI tag new images via Google Vision
    tagProjectImages(Number(id)).catch((err) =>
      console.error('[vision-tagging] Background tagging failed:', err)
    );
  } catch (error) {
    if (error instanceof Error && error.message === PROJECT_IMAGES_REQUIRED_ERROR) {
      return res.status(400).json({ error: 'At least one project image is required.' });
    }
    if (error instanceof Error && error.message === BASE64_IMAGES_NOT_ALLOWED_ERROR) {
      return res.status(400).json({ error: 'Image upload must be processed before submission. Please try uploading again.' });
    }
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project.' });
  }
}

export async function deleteProject(req: any, res: any) {
  try {
    const { id } = req.params;
    
    const [project] = await pool.execute(
      'SELECT * FROM projects WHERE id = ?',
      [id]
    );
    
    if ((project as any[]).length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    
    // Permission check: verify user owns this project via company_profiles
    const delProjectRow = (project as any[])[0];
    const [delOwnerCheck] = await pool.execute(
      'SELECT id FROM company_profiles WHERE id = ? AND user_id = ?',
      [delProjectRow.company_profile_id, req.user.userId]
    );
    if ((delOwnerCheck as any[]).length === 0) {
      return res.status(403).json({ error: 'You cannot delete another designer\'s project.' });
    }
    
    await pool.execute(
      'DELETE FROM projects WHERE id = ?',
      [id]
    );

    setImmediate(() => {
      logActivity({
        userId: req.user.userId, userName: null as any, userRole: 'company',
        action: 'delete', targetType: 'project', targetId: Number(req.params.id),
        description: '删除了项目',
        ip: getClientIp(req),
      }).catch(() => {});
    });

    res.json({ message: 'Project deleted.' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project.' });
  }
}
