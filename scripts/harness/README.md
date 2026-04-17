# Harness Engineering 工具集

自定义 linter 和检查工具，机械强制执行 docs/RELIABILITY.md 中的不变量。

## 工具列表

| 脚本 | 功能 | 何时运行 |
|------|------|---------|
| `lint-reliability.mjs` | 检查数据源合并顺序、base64禁令等不变量 | 每次提交前、CI |
| `lint-cors-nginx.mjs` | 检查 CORS 白名单与 Nginx 配置一致性 | 部署前 |
| `lint-seo.mjs` | 检查公开页面 SEO 完整性（title/og/canonical/JSON-LD） | 部署前 |
| `lint-docs-freshness.mjs` | 检查文档是否过时（超过30天未更新） | 每周 |
| `lint-mobile.mjs` | 检查移动端适配：底部导航、路由注册、响应式间距、无溢出宽度 | 每次提交前、部署前 |
| `lint-auth-flow.mjs` | 检查注册/登录/手机收集/忘记密码/缩略图生成等关键流程完整性（代码级） | 每次提交前、部署前 |
| `lint-admin-ui.mjs` | 检查后台管理页面 UI 规范：tooltip 溢出、工具栏间距统一、禁止 raw select | 改 admin 页面时 |
| `test-auth-e2e.mjs` | Auth 端到端测试：注册→验证→登录→建 profile→手机同步→忘记密码（18 项） | 部署前必跑 |
| `lint-scraper-sync.mjs` | 检查爬虫 JSON 与数据库 portfolio_images 是否同步 | 过滤/去重后、部署前 |
| `smoke-production.mjs` | 生产环境冒烟测试（首页、API、图片） | 部署后 |
| `pre-deploy-gate.sh` | 部署前门禁：跑 linter + 构建 + 测试 | 部署前 |

## 使用方式

```bash
node scripts/harness/lint-reliability.mjs     # 检查不变量
node scripts/harness/lint-cors-nginx.mjs      # 检查 CORS/Nginx 一致性
node scripts/harness/lint-seo.mjs             # 检查 SEO 合规
node scripts/harness/lint-docs-freshness.mjs  # 检查文档保鲜
node scripts/harness/smoke-production.mjs     # 生产冒烟测试
node scripts/harness/lint-admin-ui.mjs        # 检查后台 UI 规范
bash scripts/harness/pre-deploy-gate.sh       # 部署前完整检查
```

## 开发流程（MUST FOLLOW）

改动 `src/pages/admin/` 下的文件前，**先跑对应 harness lint**：

```bash
node scripts/harness/lint-admin-ui.mjs   # admin 页面 UI 规范
node scripts/harness/lint-mobile.mjs     # 移动端适配
```

开发完成后再跑一次确认无新问题。不要等 code review 才发现。
