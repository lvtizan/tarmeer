#!/usr/bin/env node
// 用例：合作方图片管线 downloadWithRetry 在跨区网络瞬时失败时应重试并最终成功；
// 全部失败时应抛错(调用方兜底占位图)。防止回归到"单次 15s 超时即回退占位"的老行为。
// 注入 fake downloader 测重试循环本身，不碰真实网络，也不绕过 download 的 SSRF 私网防护。
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { downloadWithRetry } = require("../../server/dist/lib/partnerImageService");

(async () => {
  let cases = 0, pass = 0;

  // UC1: 前 2 次失败(模拟 SSL 中断/超时)，第 3 次成功 → 应返回成功
  cases++;
  let calls = 0;
  const dest = path.join(os.tmpdir(), `reheal-test-${process.pid}.img`);
  const flaky = async (url, d) => {
    calls++;
    if (calls < 3) throw new Error("SSL_ERROR_SYSCALL");
    fs.writeFileSync(d, "fake-image-bytes");
    return d;
  };
  try {
    const r = await downloadWithRetry("http://x/img.jpg", dest, 3, flaky);
    assert.strictEqual(calls, 3, `应重试到第 3 次才成功，实际调用 ${calls} 次`);
    assert.strictEqual(r, dest);
    assert.ok(fs.existsSync(dest) && fs.statSync(dest).size > 0, "文件应已写入且非空");
    console.log("UC1 PASS：瞬时失败后重试成功");
    pass++;
  } catch (e) { console.log("UC1 FAIL：", e.message); }
  finally { fs.unlink(dest, () => {}); }

  // UC2: 3 次全失败 → 应抛出最后一次错误(触发调用方占位兜底)
  cases++;
  let calls2 = 0;
  const dead = async () => { calls2++; throw new Error("timeout"); };
  try {
    await downloadWithRetry("http://x/y.jpg", "/tmp/na", 3, dead);
    console.log("UC2 FAIL：全失败却未抛错");
  } catch (e) {
    assert.strictEqual(calls2, 3, `应尝试满 3 次，实际 ${calls2} 次`);
    assert.match(e.message, /timeout/);
    console.log("UC2 PASS：全失败尝试满 3 次并抛错");
    pass++;
  }

  console.log(`\n${pass}/${cases} PASS`);
  process.exit(pass === cases ? 0 : 1);
})();
