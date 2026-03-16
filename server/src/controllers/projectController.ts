import pool from '../config/database';
import { sendProjectSubmissionEmail } from '../services/emailService';
import { getProjectStatusForDesignerSubmit } from '../lib/projectReview';
import { buildPublicProjectsListQuery } from '../lib/publicProjectsQuery';
import { parseJsonField } from '../lib/parseJsonField';
import { sanitizePublicProject } from '../lib/publicDesignerSerialization';
import { buildProjectPersistenceValues } from '../lib/projectPersistence';

function normalizeProject(project: any) {
  return {
    ...project,
    images: parseJsonField(project.images) || [],
    tags: parseJsonField(project.tags) || [],
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
    const designer_id = req.user.id;
    const { title, description, style, location, area, year, cost, images, tags, status } = req.body;
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
      images,
      tags,
      status: projectStatus,
    });
    
    const [result] = await pool.execute(
      `INSERT INTO projects (designer_id, title, description, style, location, area, year, cost, images, tags, status, rejection_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        designer_id,
        values.title,
        values.description,
        values.style,
        values.location,
        values.area,
        values.year,
        values.cost,
        values.images,
        values.tags,
        values.status,
      ]
    );
    
    const projectId = (result as any).insertId;
    
    const [project] = await pool.execute(
      'SELECT * FROM projects WHERE id = ?',
      [projectId]
    );
    
    const [designer] = await pool.execute(
      'SELECT * FROM designers WHERE id = ?',
      [designer_id]
    );
    
    try {
      await sendProjectSubmissionEmail((project as any[])[0], (designer as any[])[0]);
    } catch (notificationError) {
      console.error('Project submission notification error:', notificationError);
    }
    
    res.status(201).json({
      message: 'Project submitted successfully.',
      project: normalizeProject((project as any[])[0])
    });
  } catch (error) {
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
    
    let whereClause = `WHERE p.status = ? AND d.status = 'approved' AND d.is_approved = 1 AND d.deleted_at IS NULL`;
    const params: any[] = [status];
    
    if (designer_id) {
      whereClause += ' AND p.designer_id = ?';
      params.push(designer_id);
    }
    
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total
       FROM projects p
       INNER JOIN designers d ON p.designer_id = d.id
       ${whereClause}`,
      params
    );
    
    const total = (countResult as any[])[0].total;
    
    const listQuery = buildPublicProjectsListQuery({
      status,
      designerId: designer_id,
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
    const designerId = req.user.id;

    const [projects] = await pool.execute(
      `SELECT id, title, description, style, location, area, year, cost, images, tags, status, rejection_reason, created_at, updated_at
       FROM projects
       WHERE designer_id = ?`,
      [designerId]
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
         d.full_name as designer_name,
              d.city as designer_city, d.avatar_url as designer_avatar, d.bio as designer_bio
       FROM projects p
       INNER JOIN designers d ON p.designer_id = d.id
       WHERE p.id = ? AND p.status = 'published' AND d.status = 'approved' AND d.is_approved = 1 AND d.deleted_at IS NULL`,
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
    const { title, description, style, location, area, year, cost, images, tags, status } = req.body;
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
      images,
      tags,
      status: nextStatus,
    });
    
    const [project] = await pool.execute(
      'SELECT * FROM projects WHERE id = ?',
      [id]
    );
    
    if ((project as any[]).length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    
    if (req.user.id !== (project as any[])[0].designer_id) {
      return res.status(403).json({ error: 'You cannot edit another designer\'s project.' });
    }
    
    await pool.execute(
      `UPDATE projects 
       SET title = ?, description = ?, style = ?, location = ?, area = ?, year = ?, cost = ?, images = ?, tags = ?, status = ?, rejection_reason = NULL
       WHERE id = ?`,
      [
        values.title,
        values.description,
        values.style,
        values.location,
        values.area,
        values.year,
        values.cost,
        values.images,
        values.tags,
        values.status,
        id,
      ]
    );
    
    const [updatedProject] = await pool.execute(
      'SELECT * FROM projects WHERE id = ?',
      [id]
    );
    
    res.json({
      message: 'Updated successfully.',
      project: normalizeProject((updatedProject as any[])[0])
    });
  } catch (error) {
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
    
    if (req.user.id !== (project as any[])[0].designer_id) {
      return res.status(403).json({ error: 'You cannot delete another designer\'s project.' });
    }
    
    await pool.execute(
      'DELETE FROM projects WHERE id = ?',
      [id]
    );
    
    res.json({ message: 'Project deleted.' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project.' });
  }
}
