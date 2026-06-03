"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureVisitorLogsTable = ensureVisitorLogsTable;
const database_1 = __importDefault(require("../config/database"));
let ensureVisitorLogsTablePromise = null;
async function ensureVisitorLogsTable() {
    if (!ensureVisitorLogsTablePromise) {
        ensureVisitorLogsTablePromise = database_1.default.execute(`CREATE TABLE IF NOT EXISTS visitor_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        viewer_ip VARCHAR(64) NOT NULL,
        location_label VARCHAR(255) DEFAULT NULL,
        page_path VARCHAR(255) DEFAULT NULL,
        referrer VARCHAR(512) DEFAULT NULL,
        user_agent VARCHAR(512) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_viewer_ip (viewer_ip),
        INDEX idx_created (created_at),
        INDEX idx_page_path (page_path)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).then(() => undefined);
    }
    await ensureVisitorLogsTablePromise;
}
