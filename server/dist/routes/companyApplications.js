"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const companyApplicationController_1 = require("../controllers/companyApplicationController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/', auth_1.authenticate, companyApplicationController_1.applyAsCompany);
router.get('/mine', auth_1.authenticate, companyApplicationController_1.getMyCompanyStatus);
exports.default = router;
