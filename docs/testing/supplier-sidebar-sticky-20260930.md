# 供应商筛选侧栏跟随页面

范围：MaterialsClient 桌面侧栏，sticky 从与 aside 同高的内层移至 aside；top 96px。内部限高视口减112px、独立滚动、隐藏滚动条。

- 结构回归 supplier-sidebar-sticky.mjs：6/6 PASS。
- smoke-test.mjs：42/42 PASS（本地 backend3315、frontend5181）。
- next build：exit 0。
- 真实浏览器1440×900：页面scrollY1800时侧栏top96/bottom884；内部scroll309/max309且页面仍1800，展厅链接bottom862.5可见。
- 手机390×844：侧栏隐藏，原手机筛选保留，无横向溢出。
- 三轮独立审查：规格安全0项、质量复审0项、整体遗漏0项，均清白。
