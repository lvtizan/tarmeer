import { Router } from 'express';
import { body } from 'express-validator';
import { createProject, getProjects, getMyProjects, getProjectById, updateProject, deleteProject } from '../controllers/projectController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/',
  authenticate,
  [
    body('title').notEmpty().withMessage('Project title is required'),
    body('description').notEmpty().withMessage('Project description is required')
  ],
  createProject
);

router.get('/', getProjects);
router.get('/my', authenticate, getMyProjects);
router.get('/:id', getProjectById);

router.put('/:id',
  authenticate,
  [
    body('title').notEmpty().withMessage('Project title is required'),
    body('description').notEmpty().withMessage('Project description is required')
  ],
  updateProject
);

router.delete('/:id', authenticate, deleteProject);

export default router;
