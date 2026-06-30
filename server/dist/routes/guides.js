"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const guideController_1 = require("../controllers/guideController");
const router = (0, express_1.Router)();
// Public
router.get('/public', guideController_1.listGuides);
router.get('/public/:slug', guideController_1.getGuide);
exports.default = router;
