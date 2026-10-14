---
name: tarmeer-image-pipeline
description: Tarmeer 静态图片全流程——生成多档 WebP 变体、rsync 上线、前端引用规范、防误删。适用于：新增任何 hero/about/营销/公司图片、图片线上 404、图片加载慢/CLS 问题。铁律：没生成 4 档变体的图片禁止上线；git push 不会让图片上线。
---

# 图片全流程

## 何时不用本技能

- 用户上传的业务图片（走 `/uploads/`，由后端 API 管理）→ 与本流程无关
- 图片显示了但比例/样式不对 → `tarmeer-ui-conventions`（aspect-video 等规范）
- 页面 404 但不是图片 → `tarmeer-debugging`

## 核心认知：图片和代码是两条独立上线通道

nginx 把 `/images/` 指向服务器 `/tarmeer/tarmeer_web_portal/images/`，**不是** Next 的 `public/`。所以 `public/images/` 下的新图 git push + 前端部署后**线上依然 404**，必须单独 rsync。这是 2026-06-17 的真实踩坑。

## 标准四步（缺一不可）

```bash
# ① 生成 4 档 WebP 变体（-blur 64px / -thumb 600 / -medium 1200 / full ≤2000，自动 chmod 644）
# 参数格式：源文件绝对路径::输出前缀（仓库内相对路径，不带扩展名）
node scripts/gen-image-variants.mjs \
  '/abs/path/src/foo.png::public/images/about/foo'
# 产出 foo-blur.webp / foo-thumb.webp / foo-medium.webp / foo.webp

# ② git commit + 前端部署（代码引用）→ tarmeer-deploy-frontend

# ③ rsync 图片到 portal 目录（不加 --delete！）
rsync -avz public/images/about/ \
  -e "ssh -i ~/.ssh/tarmeer_ecs" \
  root@47.91.108.104:/tarmeer/tarmeer_web_portal/images/about/

# ④ 验证
curl -sI https://www.tarmeer.com/images/about/foo.webp   # 必须 200
```

VN 公司爬虫图片：走 AGENTS.md 第三步的 rsync（`public/images/vn-companies/` → portal 的 `images/vn-companies/`）。4 档变体铁律针对 hero/about/营销类**手工新增**的静态图；爬虫批量图片按其自有流程（download → check → filter），但 rsync 上线 + 644 权限 + curl 验证同样必须。

## 防删铁律

历史上发生过**全站图片被删除、被迫全部重新上传**的事故。因此：

1. 任何针对 `/tarmeer/tarmeer_web_portal/images/` 的 rsync **禁止 `--delete`**。
2. 任何删除/清理服务器图片的操作（含"清理失效引用"类脚本）必须先向用户列出将删内容并获得确认。
3. 清理生产库失效图片引用用服务器上的专用脚本（如 `/tmp/purge-vn-missing.js`），它删的是 DB 引用不是文件。
4. 大批量图片操作前，先 `ls | wc -l` 记录数量，操作后核对。

## 前端引用规范

- 用 `ProgressiveImage`（`src/components/ui/ProgressiveImage.tsx`，模糊→清晰）或 `<img srcSet sizes>`（`-thumb 600w / -medium 1200w / full 2000w`）
- 默认 `loading="lazy"`；hero/LCP 图用 `eager` + `fetchPriority="high"`
- 显式宽高或 aspect 类防 CLS
- 权限：文件 644、目录 755（600 = nginx 403）

## 图片过滤脚本

`scripts/filter-portfolio-images.js` 依赖本地图片文件 + sharp，**只能本地跑**，改的是本地 DB（DB_HOST=localhost），生产库不受影响。

## 姊妹文档

图片相关 DB 操作 → `tarmeer-database-ops`；上线后图片 404/403 排查 → `tarmeer-debugging`。


## [2026-10-14] 商品图片加载完成后仍显示 Loading
- **现象**：供应商 supplier-1127 产品列表中，图片已下载完成（complete=true、naturalWidth=1200），但仍显示 Loading image… 且图片透明；材料目录和商品详情共用同一组件，也存在风险。
- **根因**：MaterialImage 仅依赖 onLoad/onError 更新状态，未处理 SSR hydration 前或缓存中已经完成的图片。
- **修复**：挂载及每次回退/重试后检查当前图片的 complete/naturalWidth，同步成功或失败状态；按 src 隔离加载与回退状态；新增 material-image-loading.mjs 回归用例。
- **预防规则**：图片加载提示不能只依赖 DOM 事件；必须覆盖缓存成功、缓存失败、原图回退、重试和 src 切换。浏览器验收检查已加载图片旁不存在加载提示，也没有 opacity-0。


## [2026-10-14] 长条石材素材与 Word 场景图归属
- **现象**：约 1:3 的板材图放进横向商品卡会被裁切或留大块空白；仅统计文件夹图片会漏掉 Word 内的场景图，直接解压全部 media 又会混入模板遗留图。
- **根因**：卡片按横图设计；DOCX 的媒体目录不等于正文实际使用的图片。
- **修复**：明确声明 Full slab 的商品使用竖版 contain 展示及更密的宽屏列数；详情分开产品图和应用参考图。抽图沿 document.xml 的 r:embed 与 document.xml.rels 解析实际引用，再核对型号、纹理与水印。
- **预防规则**：石材原图不裁切、不拉伸、不生成替代纹理；场景图需按所属型号核对；未引用 media 不得作为产品资料；四档缓存是每张图片的变体，不是强制每款凑四张图；缺场景必须明确待补，不能借用其他款图片。
