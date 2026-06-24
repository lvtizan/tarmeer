#!/usr/bin/env node
/**
 * Stop-hook 收工把关：改了后端/脚本/前端代码且未提交时，收工前自动跑 smoke harness；
 * 未绿则阻止收工并把失败回抛给 Claude 修复。AGENTS.md 第六步的自动化执行。
 *
 * 行为（全部不抛异常，永远输出一段 JSON 到 stdout）：
 *   - 无未提交代码改动            → {} （静默放行，纯对话/已提交时不空跑）
 *   - 有改动但 3002/5180 未全起   → systemMessage 提醒，放行（不阻塞，避免死循环）
 *   - 有改动且服务在 + smoke 绿   → systemMessage ✅，放行
 *   - 有改动且服务在 + smoke 红   → decision:block，回抛失败日志
 *
 * REPO 由脚本自身位置推导（<repo>/scripts/harness/stop-gate.mjs），跨 checkout 可用。
 */
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const emit = (o) => { process.stdout.write(JSON.stringify(o)); process.exit(0); };
const reachable = (port) => {
  try { execSync(`curl -s --noproxy '*' -o /dev/null --max-time 3 http://localhost:${port}/`, { stdio: "ignore" }); return true; }
  catch { return false; }
};

// 只看「已跟踪文件的未提交改动」(git diff HEAD)，忽略未跟踪噪音(node_modules/爬虫产物等)；
// 我的流程每个任务测完即 commit，所以干净树/纯对话时这里为空 → 静默放行，不每轮空跑。
let changed = "";
try { changed = execSync(`git -C "${REPO}" diff --name-only HEAD -- server scripts src`, { encoding: "utf8" }).trim(); } catch { /* not a repo / git missing */ }
if (!changed) emit({});

if (!reachable(3002) || !reachable(5180)) {
  emit({ systemMessage: "⚠️ 有未提交代码改动，但本地服务（3002/5180）未全起，跳过自动用例——请手动跑 harness 验证再收工。" });
}

try {
  execSync(`node "${REPO}/scripts/harness/smoke-test.mjs"`, { cwd: REPO, stdio: "pipe", encoding: "utf8" });
  emit({ systemMessage: "✅ 自动 smoke harness 全绿（收工把关通过）" });
} catch (e) {
  const log = String((e.stdout || "") + (e.stderr || "")).slice(-1500);
  emit({ decision: "block", reason: "收工把关：自动 smoke harness 未绿，先修复再收工。\n" + log });
}
