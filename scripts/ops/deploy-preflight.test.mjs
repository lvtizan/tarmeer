import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeploymentConfig, deploymentConnection } from './deploy-preflight.mjs';

test('private config is parsed as data and never evaluated as shell', () => {
  const config = parseDeploymentConfig('TARMEER_DEPLOY_HOST=47.91.108.104\nexport TARMEER_DEPLOY_KEY="~/.ssh/tarmeer_ecs"\nDEPLOY_SSH_PASSWORD=\'$(do-not-run)\'\n');
  assert.equal(config.TARMEER_DEPLOY_KEY, '~/.ssh/tarmeer_ecs');
  assert.equal(config.DEPLOY_SSH_PASSWORD, '$(do-not-run)');
  assert.throws(() => parseDeploymentConfig('source secret.sh'), /Invalid/);
});

test('key connection uses known host verification and batch mode', () => {
  const c = deploymentConnection({ TARMEER_DEPLOY_KEY: '~/.ssh/tarmeer_ecs' }, p => p === '/test-home/.ssh/tarmeer_ecs', '/test-home');
  assert.equal(c.command, 'ssh');
  assert.ok(c.args.includes('/test-home/.ssh/tarmeer_ecs'));
  assert.ok(c.args.includes('StrictHostKeyChecking=yes'));
  assert.equal(c.target, 'root@47.91.108.104');
});

test('password fallback uses process environment and never command arguments', () => {
  const c = deploymentConnection({ DEPLOY_SSH_PASSWORD: 'sensitive-value' }, () => false, '/test-home');
  assert.equal(c.command, 'sshpass');
  assert.equal(c.env.SSHPASS, 'sensitive-value');
  assert.equal(JSON.stringify(c.args).includes('sensitive-value'), false);
});

test('missing explicit key fails clearly rather than silently falling back', () => {
  assert.throws(() => deploymentConnection({ TARMEER_DEPLOY_KEY: '/missing' }, () => false, '/test-home'), /does not exist/);
});

test('host alias uses existing SSH config and rejects option injection', () => {
  assert.equal(deploymentConnection({ TARMEER_DEPLOY_SSH_ALIAS: 'tarmeer-production' }, () => false, '/test-home').target, 'tarmeer-production');
  assert.throws(() => deploymentConnection({ TARMEER_DEPLOY_HOST: '-oProxyCommand=bad' }, () => false, '/test-home'), /Invalid/);
});
