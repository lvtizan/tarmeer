"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const designerController_1 = require("../controllers/designerController");
const designerApplicationController_1 = require("../controllers/designerApplicationController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Designer application routes (must be before /:id to avoid conflict)
router.post('/apply', auth_1.authenticate, designerApplicationController_1.applyAsDesigner);
router.get('/my-status', auth_1.authenticate, designerApplicationController_1.getMyDesignerStatus);
router.get('/', designerController_1.getDesigners);
router.get('/:id', designerController_1.getDesignerById);
router.put('/:id', auth_1.authenticate, designerController_1.updateDesigner);
exports.default = router;
