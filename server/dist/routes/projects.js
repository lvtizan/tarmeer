"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const projectController_1 = require("../controllers/projectController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/', auth_1.authenticate, [
    (0, express_validator_1.body)('title').notEmpty().withMessage('Project title is required'),
    (0, express_validator_1.body)('description').notEmpty().withMessage('Project description is required')
], projectController_1.createProject);
router.get('/', projectController_1.getProjects);
router.get('/my', auth_1.authenticate, projectController_1.getMyProjects);
router.get('/:id', projectController_1.getProjectById);
router.put('/:id', auth_1.authenticate, [
    (0, express_validator_1.body)('title').notEmpty().withMessage('Project title is required'),
    (0, express_validator_1.body)('description').notEmpty().withMessage('Project description is required')
], projectController_1.updateProject);
router.delete('/:id', auth_1.authenticate, projectController_1.deleteProject);
exports.default = router;
