"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rewriteSchemaSql = rewriteSchemaSql;
function rewriteSchemaSql(sql, dbName) {
    return sql
        .replace(/CREATE DATABASE IF NOT EXISTS tarmeer/g, `CREATE DATABASE IF NOT EXISTS \`${dbName}\``)
        .replace(/USE tarmeer;/g, `USE \`${dbName}\`;`);
}
