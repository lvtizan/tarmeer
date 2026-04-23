# Incident: 全站上传图片 404 — Nginx Location 优先级

**日期**: 2026-04-23
**严重性**: P1 — 全站所有装企上传的项目图片、Avatar 全部 404
**引入时机**: 性能优化加图片缓存 regex location 时
**修复耗时**: ~30 分钟

---

## 现象

- `GET /api/uploads/projects/*/new/2026/04/*.webp` → 404
- 浏览器控制台大量图片加载失败，Portfolio、CompanyDetail、CompaniesPage 均受影响
- 直接 curl 后端 `localhost:3002/api/uploads/...` → 200（文件存在）
- 经 nginx 转发后 → 404

---

## 根因

Nginx location 匹配优先级：

| 类型 | 语法 | 优先级 |
|------|------|--------|
| 精确匹配 | `location = /path` | **最高** |
| 前缀 + 停止正则 | `location ^~ /path/` | 次高，**打败所有 regex** |
| 正则（区分大小写）| `location ~ regex` | 高 |
| 正则（不区分大小写）| `location ~* regex` | 高 |
| 普通前缀 | `location /path/` | **最低** |

本次在性能优化时新增：
```nginx
location ~* \.(jpg|jpeg|png|gif|webp|ico|svg)$ { ... }  # 图片缓存
location ~* \.(js|css)$ { ... }                          # JS/CSS 缓存
```

这两个 regex location 优先级高于原有的：
```nginx
location /uploads/ { alias ...; }   # 无 ^~，被 regex 截胡
location /api/ { proxy_pass ...; }  # 无 ^~，被 regex 截胡
```

结果：`/api/uploads/projects/2034/.../foo.webp` 被图片 regex 拦截，
nginx 从 server root `/tarmeer/tarmeer_web_portal/` 找 `api/uploads/...` → 不存在 → 404。

---

## 修复

给所有代理/alias 前缀 location 加 `^~`：

```nginx
# Before（有 bug）
location /uploads/ { ... }
location /api/ { ... }

# After（修复）
location ^~ /uploads/ { ... }
location ^~ /api/ { ... }
```

`^~` 告诉 nginx：如果路径匹配此前缀，直接用这个 location，不再检查任何 regex。

---

## 验证

```bash
# 直接测 nginx（绕过 Cloudflare）
curl -s -o /dev/null -w '%{http_code}' \
  --resolve 'www.tarmeer.com:443:127.0.0.1' \
  'https://www.tarmeer.com/api/uploads/projects/2034/new/2026/04/xxx.webp' -k
# 期望: 200

curl -s -o /dev/null -w '%{http_code}' \
  --resolve 'www.tarmeer.com:443:127.0.0.1' \
  'https://www.tarmeer.com/api/health' -k
# 期望: 200
```

---

## 铁律：每次改 nginx 前必须执行

1. **列出所有 location 块**，标出哪些是 regex（`~`, `~*`）
2. **确认所有 proxy_pass / alias 前缀 location 都有 `^~`**
3. **有 regex location 时**，重新过一遍所有前缀 location，挨个加 `^~`
4. **改完后测试**：curl `/api/uploads/*.jpg`、`/uploads/*.jpg`、`/api/health` 全 200
5. `nginx -t` 通过后才能 reload
