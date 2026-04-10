# Harness Engineering 工具集

自定义 linter 和检查工具，机械强制执行 docs/RELIABILITY.md 中的不变量。

## 工具列表

| 脚本 | 功能 | 何时运行 |
|------|------|---------|
| `lint-reliability.mjs` | 检查数据源合并顺序、base64禁令等不变量 | 每次提交前、CI |
| `lint-cors-nginx.mjs` | 检查 CORS 白名单与 Nginx 配置一致性 | 部署前 |
| `lint-seo.mjs` | 检查公开页面 SEO 完整性（title/og/canonical/JSON-LD） | 部署前 |
| `lint-docs-freshness.mjs` | 检查文档是否过时（超过30天未更新） | 每周 |
| `smoke-production.mjs` | 生产环境冒烟测试（首页、API、图片） | 部署后 |
| `pre-deploy-gate.sh` | 部署前门禁：跑 linter + 构建 + 测试 | 部署前 |

## 使用方式

```bash
node scripts/harness/lint-reliability.mjs     # 检查不变量
node scripts/harness/lint-cors-nginx.mjs      # 检查 CORS/Nginx 一致性
node scripts/harness/lint-seo.mjs             # 检查 SEO 合规
node scripts/harness/lint-docs-freshness.mjs  # 检查文档保鲜
node scripts/harness/smoke-production.mjs     # 生产冒烟测试
bash scripts/harness/pre-deploy-gate.sh       # 部署前完整检查
```
