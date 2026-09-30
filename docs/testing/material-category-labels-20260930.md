# 分类侧栏显示验收

- 修改仅涉及 MegaMenuDirectory 的三个 class：完整换行名称、商品数量单行、隐藏滚动条但保留 overflow-y-auto。
- `node scripts/harness/material-category-labels.mjs`：5/5 PASS。
- `HARNESS_BACKEND=http://localhost:3315 HARNESS_FRONTEND=http://localhost:5181 node scripts/harness/smoke-test.mjs`：42/42 PASS。
- `next build` exit 0。开发缓存与构建并行导致临时类型/路由异常后，停 dev、移走隔离工作树 .next/dev 缓存，以构建产物重新验证全绿。
- 浏览器1440px：长分类完整显示，两行高40px，名称无横向裁切；scrollbar-width:none / overflow-y:auto。
- 三轮独立审查：规格安全0项、质量0项、整体遗漏0项，全部清白。
