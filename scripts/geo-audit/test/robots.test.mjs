import { test } from 'node:test';
import assert from 'node:assert/strict';
import { robotsAllows } from '../lib/robots.mjs';

test('单一 User-agent 全站封禁 → false', () => {
  const txt = 'User-agent: GPTBot\nDisallow: /';
  assert.equal(robotsAllows(txt, 'GPTBot'), false);
});

test('分组 User-agent:被封禁的组内每个 agent 都判 false(旧实现会误判首个为 true)', () => {
  const txt = 'User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /';
  assert.equal(robotsAllows(txt, 'GPTBot'), false);
  assert.equal(robotsAllows(txt, 'ClaudeBot'), false);
});

test('未提及的 bot 落到 * 组', () => {
  const txt = 'User-agent: *\nDisallow: /';
  assert.equal(robotsAllows(txt, 'PerplexityBot'), false);
});

test('放行(仅封禁具体路径,非全站)→ true', () => {
  const txt = 'User-agent: *\nDisallow: /admin/';
  assert.equal(robotsAllows(txt, 'GPTBot'), true);
});

test('注释与空行不影响解析', () => {
  const txt = '# rules\n\nUser-agent: GPTBot  # ai\nDisallow: /   # block all\n';
  assert.equal(robotsAllows(txt, 'GPTBot'), false);
});

test('空 robots.txt / 无匹配 → 默认允许', () => {
  assert.equal(robotsAllows('', 'GPTBot'), true);
  assert.equal(robotsAllows('User-agent: Googlebot\nDisallow: /', 'GPTBot'), true);
});
