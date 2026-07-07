# TODO — 明天公司部署

## 待办：部署营销跟踪器恢复（前端）

代码已在 `origin/main`（commit `f64e941d`），本地已验证全绿，**只差在公司机器上部署**。

### 改动内容
- 恢复 Next.js 迁移时丢失的 4 个营销跟踪器：GTM `GTM-NLB9VWLM`、GA4 `G-KRXL45QLMB`、Meta 双 ID `1435092104500532`+`1866475261423119`、TikTok `D7CRM0RC77UEG1PVEUKG`
- 新增 `src/components/TrackingScripts.tsx`，挂进 `src/app/layout.tsx` 的 `<body>`
- **国家隔离**：仅在 AE 站（www.tarmeer.com）触发；VN/SA 不触发，避免污染 UAE 营销账户
- 版本号 bump 0.1.20 → 0.1.21

### 部署步骤（前端标准流程）
```bash
# 公司机器上，Next 应用目录（用 pm2 describe tarmeer-next 查 cwd）
git pull            # 拉到 f64e941d
next build          # 必须 exit 0
pm2 restart tarmeer-next
cat .next/BUILD_ID  # 记下值，确认 restart 后是新的
```

### 部署后必须验证（防 build 静默失败跑旧版）
```bash
curl -s https://www.tarmeer.com | grep -c 'G-KRXL45QLMB'   # 应 ≥ 1
curl -s https://vn.tarmeer.com  | grep -c 'G-KRXL45QLMB'   # 应 = 0（VN 不该有）
```
再到 GA4「迪拜建材城」数据流看"数据收集"是否转为已启用（黄条消失，可能有延迟）。

### 注意
- 本地这个 checkout（`~/Code/tarmeer`）`node_modules` 原本残缺，我跑过 `npm install` 修好才能 build；因此 `package-lock.json` 本地被改动，**按要求未提交**，公司机器不受影响。
- 已知限制：SPA 客户端路由切换不重发 PageView（仅首屏加载发），与原站一致，属另行跟进项。
- 若 VN/SA 需要各自的跟踪器 ID，补给我，按同样的国家门控加。
