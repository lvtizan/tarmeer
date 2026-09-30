# 采购筛选下拉样式验收（2026-09-30）

范围：商品目录 Supplier location、Availability、Price currency、Price unit、Sort 五个筛选。使用局部 ProcurementSelect，避免修改 AdminSelect 全部调用点；原生 SelectField 仍使用系统菜单，AdminSelect 缺本次需要的单项 disabled 与完整键盘行为，因此未改共享组件。

结果：白底选项、品牌金色选中态，箭头右侧 16px；保持原筛选值及排序限制。无后端或数据库产品改动。

- `node scripts/harness/procurement-select.mjs`：11/11 PASS，涵盖五入口、选择、方向键/Home/End、Escape、禁用排序与焦点。
- `HARNESS_BACKEND=http://localhost:3315 HARNESS_FRONTEND=http://localhost:5181 node scripts/harness/smoke-test.mjs`：42/42 PASS。
- `next build`：exit 0。
- 浏览器桌面：展开菜单白底，方向键与 Return 选择 AED，URL 正确更新；390px 手机：背景 rgb(255,255,255)、paddingRight 16px，无横向溢出；Escape 关闭并返回触发按钮，Tab 关闭到下一控件；缺单位时两个价格排序项 disabled。
- 本地页面因未配置默认 3002 代理出现数据加载空态，仅用于本次控件交互；上线后另验实际数据与菜单。
- 三轮独立审查：第1轮规格安全 0 项，第2轮质量复审 0 项，第3轮整体遗漏 0 项，均清白。

测试环境修复：首次独立工作树缺少本地 server/.env/deps，补齐后，HTTP 账号用例因本地签名与远端不一致返回401；改用本地3315后全部通过。生产未创建测试账号。
