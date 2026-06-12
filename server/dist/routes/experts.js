"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const expertController_1 = require("../controllers/expertController");
const router = (0, express_1.Router)();

// 专家文件上传（头像/资格证/执照）
const EXPERT_FILES_DIR = path_1.default.join(__dirname, '..', '..', 'public', 'uploads', 'expert-files');
fs_1.default.mkdirSync(EXPERT_FILES_DIR, { recursive: true, mode: 0o755 });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, EXPERT_FILES_DIR),
    filename: (_req, file, cb) => {
        const ext = (path_1.default.extname(file.originalname) || '.jpg').toLowerCase().slice(0, 10);
        cb(null, `expert-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = /image\/(jpeg|png|webp)|application\/pdf/.test(file.mimetype);
        cb(ok ? null : new Error('Only images or PDF allowed'), ok);
    },
});

// 公开
router.get('/', expertController_1.listPublicExperts);
router.get('/cities', expertController_1.listExpertCities);

// 个人中心（auth）— 注意必须先于 /:slug 注册
router.get('/me', auth_1.authenticate, expertController_1.getMyExpertProfile);
router.post('/me', auth_1.authenticate, expertController_1.upsertExpertProfile);
router.get('/me/inquiries', auth_1.authenticate, expertController_1.getMyExpertInquiries);
router.get('/me/stats', auth_1.authenticate, expertController_1.getMyExpertStats);
router.post('/me/upload', auth_1.authenticate, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    // sharp/multer 写出的文件可能 600 权限 → nginx 403（已知坑），统一修权
    await fs_1.default.promises.chmod(req.file.path, 0o644).catch(() => { });
    res.json({ url: `/uploads/expert-files/${req.file.filename}` });
});

// 公开详情（放在 /me 之后避免路径冲突）
router.get('/:slug', expertController_1.getPublicExpert);

exports.default = router;
