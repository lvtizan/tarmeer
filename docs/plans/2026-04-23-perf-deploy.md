# Homepage Performance Fix — Deploy Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将三项已完成的性能修复部署到生产环境，解决首页 397 次重复请求、20 分钟加载的问题。

**Architecture:** 本次部署纯配置 + 静态资源变更，不涉及后端 API，不需要数据库迁移。改动范围：Nginx 静态缓存配置、前端 React 组件（slider opacity-toggle）、index.html（LCP preload + 像素去重）。

**Tech Stack:** Nginx, Vite, React, rsync over SSH

---

## 已完成的本地改动（只需部署，无需再编写代码）

| 文件 | 改动内容 |
|------|---------|
| `nginx-tarmeer.conf` | 新增图片 30d 缓存 + JS/CSS 1y 缓存 location 块 |
| `src/components/home/HomeDesignSection.tsx` | slider 改为 opacity-toggle，所有图片一次性加载，加 srcSet WebP |
| `index.html` | 新增 LCP preload（hero-living-1-medium.webp）；像素保留 2 FB + 1 TK 延迟加载 |

---

### Task 1: 确认本地改动状态

**目的：** 确认三个文件的改动都在，没有意外遗漏。

**Files:**
- Read: `nginx-tarmeer.conf`
- Read: `src/components/home/HomeDesignSection.tsx`
- Read: `index.html`

**Step 1: 确认 nginx 有缓存 location 块**

```bash
grep -n "expires\|Cache-Control\|location ~\*" /Users/kp/Code/tarmeer-4.0-local/nginx-tarmeer.conf
```

预期输出中包含：
- `location ~* \.(jpg|jpeg|png|gif|webp|ico|svg)$`
- `expires 30d`
- `location ~* \.(js|css)$`
- `expires 1y`

**Step 2: 确认 index.html 有 preload 和正确像素**

```bash
grep -n "preload\|fbq\|ttq\|hero-living" /Users/kp/Code/tarmeer-4.0-local/index.html
```

预期：
- 找到 `hero-living-1-medium.webp` preload 行
- 找到 `fbq('init','1435092104500532')` 和 `fbq('init','1866475261423119')` （2 个 FB）
- 找到 `ttq.load('D7CRM0RC77UEG1PVEUKG')` （1 个 TK）
- **不应该**有重复的 pixel 初始化

**Step 3: 确认 HomeDesignSection 是 opacity-toggle 模式**

```bash
grep -n "HERO_IMAGES.map\|opacity-0\|opacity-100\|srcSet" /Users/kp/Code/tarmeer-4.0-local/src/components/home/HomeDesignSection.tsx
```

预期：找到 `HERO_IMAGES.map` + `opacity-0` + `opacity-100` + `srcSet`

如果任何一项不符，停下来告知用户，不继续执行。

---

### Task 2: 验证服务器上 WebP 变体文件存在

**目的：** srcSet 引用了 `-thumb.webp` 和 `-medium.webp`，部署前必须确认这些文件在服务器上存在，否则 srcSet 会 404。

**Files:**
- 无需改动代码

**Step 1: SSH 检查服务器上 hero WebP 文件**

```bash
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 \
  "ls -lh /tarmeer/tarmeer_web_portal/images/hero/"
```

预期：看到 `hero-living-1.jpg`、`hero-living-1-thumb.webp`、`hero-living-1-medium.webp` 等文件。

**Step 2: 如果 WebP 变体不存在，从本地同步**

```bash
# 先检查本地是否有这些文件
ls /Users/kp/Code/tarmeer-4.0-local/public/images/hero/
```

- 如果本地有 WebP 变体 → 走 Task 3 上传
- 如果本地也没有 → **停下来告知用户**，WebP 变体文件缺失，srcSet 会指向不存在的文件，需要用 ImageMagick/cwebp 生成后再部署

---

### Task 3: 上传 Nginx 配置并 reload

**目的：** 让服务器开始给图片、JS/CSS 返回正确的 Cache-Control 头。

**Files:**
- Remote: `/etc/nginx/conf.d/tarmeer.conf`（或现有 nginx 配置路径）

**Step 1: 找到服务器上 nginx 配置的实际路径**

```bash
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 \
  "nginx -T 2>/dev/null | grep 'configuration file' | head -5"
```

记录输出中 tarmeer 相关的配置文件路径。

**Step 2: 备份服务器上的现有 nginx 配置**

```bash
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 \
  "cp /etc/nginx/conf.d/tarmeer.conf /etc/nginx/conf.d/tarmeer.conf.bak.$(date +%Y%m%d%H%M%S)"
```

（路径根据 Step 1 的实际结果替换）

**Step 3: 上传新配置**

```bash
scp -i ~/.ssh/tarmeer_ecs \
  /Users/kp/Code/tarmeer-4.0-local/nginx-tarmeer.conf \
  root@47.91.108.104:/etc/nginx/conf.d/tarmeer.conf
```

**Step 4: 测试 nginx 配置语法**

```bash
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "nginx -t"
```

预期输出：`syntax is ok` + `test is successful`。如果失败，停下来，用备份恢复：
```bash
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 \
  "cp /etc/nginx/conf.d/tarmeer.conf.bak.* /etc/nginx/conf.d/tarmeer.conf && nginx -t"
```

**Step 5: Reload nginx（不中断连接）**

```bash
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "nginx -s reload"
```

**Step 6: 验证缓存头已生效**

```bash
curl -sI https://www.tarmeer.com/images/hero/hero-living-1.jpg | grep -i "cache-control\|expires"
```

预期：`Cache-Control: public, max-age=2592000`

---

### Task 4: 构建前端

**目的：** 把 HomeDesignSection.tsx 和 index.html 的改动打包进 dist/。

**Files:**
- Build output: `dist/`

**Step 1: TypeScript 类型检查**

```bash
cd /Users/kp/Code/tarmeer-4.0-local && ./node_modules/.bin/tsc --noEmit --skipLibCheck
```

预期：无错误输出，exit code 0。如有 TS 错误，停下来修复。

**Step 2: Vite 构建**

```bash
cd /Users/kp/Code/tarmeer-4.0-local && ./node_modules/.bin/vite build
```

预期：`dist/index.html` 生成，assets/ 下有带 hash 的 JS/CSS 文件。

**Step 3: 验证 dist/index.html 包含 preload 和正确像素**

```bash
grep -n "preload\|fbq\|ttq\|hero-living" /Users/kp/Code/tarmeer-4.0-local/dist/index.html
```

预期：preload 行存在，2 个 fbq init，1 个 ttq.load。

---

### Task 5: 部署前端到 ECS

**目的：** 将新 dist/ 同步到生产服务器，替换旧的 index.html 和 JS 文件。

**Step 1: rsync 整个 dist 目录**

```bash
rsync -az --delete \
  -e "ssh -i ~/.ssh/tarmeer_ecs" \
  /Users/kp/Code/tarmeer-4.0-local/dist/ \
  root@47.91.108.104:/tarmeer/tarmeer_web_portal/
```

**Step 2: 修复文件权限（防止 nginx 403）**

```bash
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 \
  "find /tarmeer/tarmeer_web_portal -type d -exec chmod 755 {} + && \
   find /tarmeer/tarmeer_web_portal -type f -exec chmod 644 {} +"
```

---

### Task 6: 生产验证

**目的：** 确认所有改动在生产环境正常工作。

**Step 1: 基础健康检查**

```bash
curl -sS -o /dev/null -w "%{http_code}" https://www.tarmeer.com/
```
预期：`200`

```bash
curl -sS -o /dev/null -w "%{http_code}" https://www.tarmeer.com/api/health
```
预期：`200`

**Step 2: 验证图片缓存头**

```bash
curl -sI https://www.tarmeer.com/images/hero/hero-living-1.jpg | grep -i cache-control
```
预期：`public, max-age=2592000`

```bash
curl -sI https://www.tarmeer.com/images/hero/hero-living-1-medium.webp 2>/dev/null | grep -i "http\|cache-control\|content-type"
```
预期：HTTP 200，`image/webp`，有 cache-control 头。（如果 404，说明 WebP 变体未上传，需执行 Task 2 Step 2）

**Step 3: 验证 JS/CSS 缓存头**

```bash
# 从 dist/index.html 取一个 JS 文件名
JS_FILE=$(grep -o 'assets/[^"]*\.js' /Users/kp/Code/tarmeer-4.0-local/dist/index.html | head -1)
curl -sI "https://www.tarmeer.com/$JS_FILE" | grep -i cache-control
```
预期：`public, max-age=31536000, immutable`

**Step 4: 验证 index.html 无重复像素**

```bash
curl -s https://www.tarmeer.com/ | grep -c "fbq('init'"
```
预期：`2`（2 个 FB 像素）

```bash
curl -s https://www.tarmeer.com/ | grep -c "ttq.load"
```
预期：`1`（1 个 TK 像素）

**Step 5: 运行 smoke test**

```bash
cd /Users/kp/Code/tarmeer-4.0-local && node scripts/harness/smoke-production.mjs
```

预期：全部 PASS。

**Step 6: 浏览器验证（人工）**

用 Chrome DevTools Network 面板打开 https://www.tarmeer.com/：
- 硬刷新（Cmd+Shift+R）后查看 hero 图片请求
- 再次普通刷新，确认 hero 图片显示 `(disk cache)` 或 304 消失
- 等待 slider 切换 3-4 次，确认 Network 面板**不产生新的图片请求**
- 检查 Console 无红色错误

---

## 回滚方案

**如果 nginx 改坏了：**
```bash
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 \
  "cp /etc/nginx/conf.d/tarmeer.conf.bak.* /etc/nginx/conf.d/tarmeer.conf && nginx -s reload"
```

**如果前端有问题：** 前一个 dist 的 hash 文件还在服务器，nginx 配置不动的情况下浏览器会缓存旧版，无需特殊操作；若需要完全回滚，重新 build 上一个 commit 即可。

---

## 执行顺序

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6
```

Task 3（nginx）和 Task 4（前端构建）可以并行启动，但 Task 5 必须等 Task 4 完成。
