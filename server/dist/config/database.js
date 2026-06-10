"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
const index_1 = __importDefault(require("./index"));
const pool = promise_1.default.createPool({
    host: index_1.default.database.host,
    port: index_1.default.database.port,
    user: index_1.default.database.user,
    password: index_1.default.database.password,
    database: index_1.default.database.name,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    // 避免连接池缓存旧的schema信息
    maxIdle: 0,
    idleTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});
exports.default = pool;
