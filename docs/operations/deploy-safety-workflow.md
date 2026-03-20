# Tarmeer 部署前必读与执行流程

最后更新：2026-03-20

## 用途

这份文档用于约束线上部署，避免以下问题再次出现：

- 图片 `403 Forbidden`
- 首页白屏或 `500`（`index.html` / `assets` 不一致）
- 半包上传导致新旧资源混用

## 部署前必须先读

部署脚本 `deploy-simple.sh` 会强制检查阅读确认。  
未确认时会直接中止部署。

先阅读：

```bash
cat docs/operations/deploy-safety-workflow.md
```

阅读后再执行：

```bash
DEPLOY_RULES_ACK=YES bash deploy-simple.sh
```

## 强制规则

1. 未收到“允许上线”明确指令，不得部署生产。
2. 仅允许通过 `deploy-simple.sh` 部署，禁止临时手工 `scp` 覆盖。
3. 生产部署只允许 `rsync` 增量同步；禁止“先清空远端再全量上传”。
4. 部署包来源必须是本地最新构建产物 `dist/`。
5. 上传后必须统一权限：
   - 目录：`755`
   - 文件：`644`
6. 部署后必须做线上可用性检查，任一失败即视为部署失败并立刻修复。

## 标准执行顺序

1. 本地检查（建议至少做）：
   - `npm run qa:smoke`
   - `npm run build`
2. 执行部署脚本（含增量同步、权限修复、Nginx reload、健康检查）：
   - `DEPLOY_RULES_ACK=YES bash deploy-simple.sh`
3. 人工打开线上页面做一次强刷确认（`Cmd+Shift+R`）。

## 脚本当前行为（deploy-simple.sh）

1. 构建：`npm run build`
2. 增量上传：`rsync -avz --delete dist/ -> /tarmeer/tarmeer_web_portal/`
3. 服务器修复权限并重载 Nginx
4. 基础健康检查：
   - `https://www.tarmeer.com`
   - `https://www.tarmeer.com/images/designers/avatars/omar-farouk.jpg`

## 部署前检查清单

- [ ] 已通读本文件
- [ ] 已收到明确上线指令
- [ ] 本地构建通过
- [ ] 无不相关高风险改动混入
- [ ] 当前分支与目标提交确认无误

## 部署后检查清单

- [ ] 首页返回 `200`
- [ ] 关键资源 URL 返回 `200`
- [ ] 图片资源返回 `200`
- [ ] 浏览器强刷后页面正常加载

## 故障快速处理

若线上异常，按顺序处理：

1. 重新上传 `dist/index.html` 与 `dist/assets`
2. 若涉及静态素材，补传 `images/`
3. 再次执行权限修复：
   - `find /tarmeer/tarmeer_web_portal -type d -exec chmod 755 {} +`
   - `find /tarmeer/tarmeer_web_portal -type f -exec chmod 644 {} +`
4. 重新执行健康检查，全部 `200` 后再对外确认恢复
