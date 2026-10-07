#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const KEYS = new Set(['TARMEER_DEPLOY_HOST', 'TARMEER_DEPLOY_USER', 'TARMEER_DEPLOY_KEY', 'TARMEER_DEPLOY_SSH_ALIAS', 'DEPLOY_SSH_KEY', 'DEPLOY_SSH_PASSWORD']);
export function parseDeploymentConfig(text) {
  const config = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Z_]+)\s*=\s*(.*)$/.exec(line);
    if (!match || !KEYS.has(match[1])) throw new Error('Invalid deployment config; use documented KEY=value entries only.');
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    config[match[1]] = value;
  }
  return config;
}

export function deploymentConnection(config, exists = existsSync, home = homedir()) {
  const host = config.TARMEER_DEPLOY_HOST || '47.91.108.104';
  const user = config.TARMEER_DEPLOY_USER || 'root';
  const alias = config.TARMEER_DEPLOY_SSH_ALIAS;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(host) || !/^[a-zA-Z0-9_]+$/.test(user) || (alias && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(alias))) throw new Error('Invalid SSH host, user or alias.');
  const target = alias || `${user}@${host}`;
  const args = ['-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15'];
  const explicitKey = config.TARMEER_DEPLOY_KEY || config.DEPLOY_SSH_KEY;
  const expand = p => p.startsWith('~/') ? path.join(home, p.slice(2)) : p;
  let key = explicitKey ? expand(explicitKey) : undefined;
  if (key && !exists(key)) throw new Error(`Configured SSH key does not exist: ${key}. Check docs/operations/deployment-runbook.md.`);
  if (!key && !alias && exists(path.join(home, '.ssh/tarmeer_ecs'))) key = path.join(home, '.ssh/tarmeer_ecs');
  if (key) args.push('-i', key, '-o', 'IdentitiesOnly=yes');
  if (!key && !alias && config.DEPLOY_SSH_PASSWORD) {
    return { command: 'sshpass', args: ['-e', 'ssh', ...args], target, mode: 'password', env: { SSHPASS: config.DEPLOY_SSH_PASSWORD } };
  }
  args.push('-o', 'BatchMode=yes');
  return { command: 'ssh', args, target, mode: alias ? 'alias' : key ? 'key' : 'default-ssh', env: {} };
}

function main() {
  const configFile = process.env.TARMEER_DEPLOY_CONFIG || path.join(homedir(), '.config/tarmeer/deploy.env');
  const fileConfig = existsSync(configFile) ? parseDeploymentConfig(readFileSync(configFile, 'utf8')) : {};
  const config = { ...fileConfig };
  for (const key of KEYS) if (process.env[key]) config[key] = process.env[key];
  const connection = deploymentConnection(config);
  console.log(JSON.stringify({ configFile, configExists: existsSync(configFile), target: connection.target, authMode: connection.mode }));
  if (process.argv.includes('--check-config')) return;
  // Read-only metadata: do not print pm2 environments or application credentials.
  const remote = `node -e 'const c=require("child_process"),fs=require("fs"); const all=JSON.parse(c.execFileSync("pm2",["jlist"],{encoding:"utf8"})); const rows=all.filter(p=>["tarmeer-next","tarmeer-api"].includes(p.name)).map(p=>{const cwd=p.pm2_env.pm_cwd; let head=null,buildId=null,dirty=null; try{head=c.execFileSync("git",["-C",cwd,"rev-parse","HEAD"],{encoding:"utf8"}).trim();dirty=c.execFileSync("git",["-C",cwd,"status","--short"],{encoding:"utf8"}).trim();}catch{} try{buildId=fs.readFileSync(cwd+"/.next/BUILD_ID","utf8").trim();}catch{}return {name:p.name,status:p.pm2_env.status,cwd,head,buildId,dirty};});console.log(JSON.stringify(rows,null,2));'`;
  const result = spawnSync(connection.command, [...connection.args, connection.target, remote], {
    env: { ...process.env, ...connection.env }, encoding: 'utf8', timeout: 30000,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.status !== 0 || result.error) {
    const message = result.error?.message || result.stderr?.trim() || 'SSH connection failed.';
    throw new Error(`${message}\nSet the verified SSH alias/key or private password config described in docs/operations/deployment-runbook.md. No deployment was performed.`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
