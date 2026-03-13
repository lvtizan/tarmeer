export function rewriteSchemaSql(sql: string, dbName: string) {
  return sql
    .replace(/CREATE DATABASE IF NOT EXISTS tarmeer/g, `CREATE DATABASE IF NOT EXISTS \`${dbName}\``)
    .replace(/USE tarmeer;/g, `USE \`${dbName}\`;`);
}
