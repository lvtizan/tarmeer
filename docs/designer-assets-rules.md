# Designer Assets Rules

最后更新：2026-03-13

## 目标

统一 5 位（或更多）公开设计师的头像与项目图管理方式，保证图片“真实可靠、可追溯、可回归验证”。

## 硬性规则

1. 每位设计师必须有独立项目图，不允许跨设计师复用同一张图。
2. 每位设计师项目数为 `5-8`，且 `coverImage` 与 `images[]` 都必须来自该设计师自己的图片集合。
3. 禁止外链热加载（运行时请求第三方图片）；页面只引用本地 `public/images/designers/**`。
4. 所有新增图片必须有来源记录（见 `docs/designer-assets-sources.md`）。
5. `src/data/designers.ts` 禁止使用“共享图库轮播”模式（如全局 `REAL_PROJECT_IMAGES + rotateImages`）。
6. 文件命名必须稳定：
   - 头像：`/images/designers/avatars/{slug}.jpg`
   - 项目图：`/images/designers/projects/{slug}-{01..08}.jpg`
7. 设计师 `slug` 必须在数据、图片文件名、下载脚本中保持一致。
8. 提交前必须通过：
   - `npm run build`
   - `npx playwright test tests/designers-seed.spec.ts --workers=1`

## 测试约束（必须长期保留）

1. `/designers` 页面应显示目标设计师数量（当前为 5）。
2. 头像和项目图全部可加载（`naturalWidth > 0`）。
3. 单个设计师个人页项目数在 `5-8`。
4. 增加“跨设计师图片不重复”断言，防止回退到共享图片。

## 维护约定

1. 新增/替换图片时，先更新来源台账，再更新下载脚本与数据文件。
2. 若设计师名或 slug 变更，要同步改：
   - `src/data/designers.ts`
   - `scripts/download-designer-assets.sh`
   - `docs/designer-assets-sources.md`
3. 若图片失效，优先替换本地文件，不改页面业务逻辑。
