// 纯函数:解析 robots.txt,判断某 bot 是否被「全站封禁」(Disallow: /)。
// 正确处理分组 User-agent(连续多行 User-agent 共享其后的规则),
// 避免把被全站封禁的爬虫误判为「放行」(旧实现按 User-agent: 切块会漏)。
// 注:仅判全站封禁,不做路径级匹配(首轮够用),但分组场景不能错。
export function robotsAllows(robotsTxt, bot) {
  const lines = (robotsTxt || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean);

  // 归组:连续的 User-agent 行累积为同一组的 agents;遇到规则后再出现 User-agent 则开新组。
  const groups = [];
  let cur = null;
  for (const line of lines) {
    const ua = line.match(/^User-agent:\s*(.+)$/i);
    if (ua) {
      if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(ua[1].trim().toLowerCase());
    } else if (cur) {
      const rule = line.match(/^(Disallow|Allow):\s*(.*)$/i);
      if (rule) cur.rules.push({ type: rule[1].toLowerCase(), path: rule[2].trim() });
    }
  }

  const bl = bot.toLowerCase();
  const group = groups.find((g) => g.agents.includes(bl)) || groups.find((g) => g.agents.includes('*'));
  if (!group) return true; // 无匹配组 → 默认允许
  // 全站封禁 = 存在 Disallow: /(且无更具体 Allow: / 覆盖——首轮不做路径级,故 Disallow:/ 即视为封禁)
  return !group.rules.some((r) => r.type === 'disallow' && r.path === '/');
}
