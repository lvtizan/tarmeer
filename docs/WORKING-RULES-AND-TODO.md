# Tarmeer 协作规则与待办

最后更新：2026-03-16

## 固定协作规则

1. 线上环境已经是生产环境。
2. 没有用户明确说“上线”，一律不得部署到线上。
3. 所有改动先在本地完成，再提供本地测试地址和验收步骤。
4. 每次完成本地改动后，默认在回复里附上：
   - 本地地址
   - 具体测试页面
   - 最短验收步骤
   - 当前是否已上线
5. 涉及 Nginx、域名、邮件、数据库、服务器配置的改动，默认按高风险处理。
6. 高风险改动必须明确：
   - 改了什么
   - 风险点
   - 回滚方式
   - 是否已执行
7. 常规改动和止血修复要区分：
   - 常规改动：只做本地，不得自动上线
   - 线上止血：只有用户已明确接受生产修复，才可执行
8. 每次新任务开始前，先阅读本文件。
9. 每次一轮工作结束后，更新本文件里的“当前待办”和“最近状态”。
10. 每次功能改动完成后，交付前必须先执行 `npm run qa:smoke`，并在回复里给出结果摘要。
11. `qa:smoke` 失败时，不得给出“可交付/可上线”结论；必须说明失败项、影响面与下一步处理。

## 默认交付格式

每次本地完成后，默认提供：

- 本地地址：`http://127.0.0.1:5173`
- 测试页面：按当前任务给出完整路径
- 验收步骤：2 到 5 条
- 发布状态：`未上线` 或 `已上线`

## 设计师后台右侧布局规范（长期）

适用范围：`/designer/*` 路由中，右侧主内容区的页面（如 Dashboard/Profile/Upload/Projects）。

1. `Sidebar` 固定宽度，`MainArea` 使用 `flex: 1` + `min-width: 0` 承接剩余空间。
2. 页面内容必须挂到同一个 `ContentContainer`：
   - `width: 100%`
   - `max-width: 980px`（可按页面复杂度放宽到同级别，但必须有上限）
   - `margin-inline: auto`
   - 统一 `padding-inline`
3. 标题、副文案、卡片区、底部动作按钮必须共享同一 `ContentContainer` 左右边界。
4. 禁止出现：
   - 内容容器只有 `max-width` 没有 `mx-auto`
   - 额外 `margin-left` 或只加左侧 padding 导致视觉偏左
   - 标题/卡片/按钮使用不同宽度体系

## 当前待办

1. 设计师上传项目失败修复：
   - 根因已定位：项目上传时可选字段 `cost` 为 `undefined`，MySQL 绑定参数报错
   - 本地已修复：`undefined -> null` 归一化，邮件通知失败不阻塞上传
   - 状态：本地完成，未上线
   - 下一步：用户确认后再上线

2. 上传前大小提示与图片压缩：
   - 本地已完成
   - 线上已部署
   - 后续如继续改动，仍按“先本地后确认”执行

3. 管理后台删除设计师：
   - 本地功能已完成
   - 资深测试小明已给出本地通过结论
   - 是否上线：待用户最终确认

4. 国际邮箱送达率优化：
   - 代码侧已补事务邮件链路和日志
   - 外部仍需 DNS / 阿里云控制台继续核对 DKIM 与投递表现
   - 状态：未完全收尾

5. 本地注册 / 登录链路：
   - 根因已扩展定位：开发态前端 API 基址固定为 `localhost:3002`，在 `127.0.0.1` 访问场景会触发网络不可达或跨域混乱
   - 本地已修复：前端 API 基址改为动态链路（跟随当前 host 自动拼接 `:3002/api`）
   - 本地已验证：`localhost/127.0.0.1` 场景均可联通后端
   - 状态：本地完成，未上线

6. 注册重号检查与项目持久化门禁：
   - 本地已完成：邮箱/手机号可用性检查接口 + 注册页失焦即时检查
   - 本地已完成：新增“注册 -> 上传 -> 退出 -> 重登 -> 项目仍在”的 Playwright 回归
   - 状态：本地完成，未上线

7. 上传页成熟交互收口：
   - 本地已完成：重复图片触发浮层式强提示，不再只是弱文字提示
   - 本地已完成：图片超过 5MB 时静默压缩
   - 本地已完成：封面按钮显式可点击手型
   - 状态：本地完成，未上线

8. 表单输入规范：
   - 本地已完成：电话类字段只保留数字
   - 本地已完成：面积类字段只允许数字和单个小数点
   - 本地已完成：姓名类字段过滤明显无效字符
   - 状态：本地完成，未上线

9. My Projects 空态兜底：
   - 本地已完成：项目同步失败时，空态和上传入口仍然优先显示
   - 本地已完成：错误降级为辅助提示，不再整页红屏
   - 状态：本地完成，未上线

10. My Projects 多图刷新持久化：
   - 根因已定位：`/api/projects/my` 直接按时间排序包含大 `images` JSON 的整行，MySQL 会报 `ER_OUT_OF_SORTMEMORY`
   - 本地已修复：改为先按 `designer_id` 安全读取，再在服务端内存按 `updated_at/created_at` 排序
   - 本地已补门禁：多图项目上传后刷新 `My Projects` 仍可见
   - 状态：本地完成，未上线

11. Edit Project 页面改版（P0+P1）：
   - 本地已完成：顶部流程信息压缩为状态栏，明确 `Ready to submit / Incomplete submission + Missing`
   - 本地已完成：Image Board 强化（封面可视化、紧凑网格、预览弹层、拖拽反馈、二次确认删除）
   - 本地已完成：提交后 `My Projects` optimistic `uploading...` 过渡态 + 自动重试
   - 本地已完成：第二轮 UI polish（Upload/Profile/Dashboard 对齐、比例、间距与卡片系统统一）
   - 状态：本地完成，未上线

## 最近状态

### 2026-03-16 QA 流程固化 + 动态 API 链路

- 已新增 QA 流程入口：
  - 根目录脚本：`npm run qa:smoke`
  - 实际脚本：`scripts/qa-smoke.sh`
  - 流程文档：`docs/operations/qa-smoke-workflow.md`
- 流程要求：
  - 每次功能改动后先跑 `qa:smoke`，再给 QA/再交付
  - 输出必须包含通过/失败摘要，不得只写“已测”
- 本轮 `qa:smoke` 结果：
  - 前端 `tsc` 通过
  - 前端 `build` 因本机 `dist` 软链接权限环境问题被安全标记（非业务编译错误）
  - 后端单测：`64 passed / 0 failed`
- 本轮同时修复：
  - `src/lib/api.ts` 改为动态 API 基址解析（`VITE_API_URL` 优先，其次开发态按当前 host，生产态同域 `/api`）
- 发布状态：未上线

### 2026-03-16 Upload/Profile/Dashboard 第二轮 UI polish

- 本地改动文件：
  - `src/pages/designer/DesignerUploadPage.tsx`
  - `src/pages/designer/DesignerProfileEditPage.tsx`
  - `src/pages/designer/DesignerDashboardPage.tsx`
- 本地优化点：
  - Upload：统一主容器宽度系统；上区与下区同边界；双栏改为右侧更宽；Current Cover 改为横向比例预览；细化节奏间距
  - Profile：压缩卡片间距与底部动作间距；头像卡片对齐更稳；保存按钮与主内容左线对齐
  - Dashboard：欢迎区/统计卡/项目区统一卡片系统；封面比例与标题高度统一；Edit 动作更明确；上传按钮位置重排
- 本地验证：
  - `npx tsc --noEmit` 通过
  - `npx playwright test tests/auth-registration-persistence.spec.ts -g "edit project shows incomplete submission status with explicit missing fields|designer project with a heavy gallery survives a My Projects refresh" --workers=1` 通过
- 发布状态：未上线

### 2026-03-16 Edit Project 改版补充

- 本地改动文件：
  - `src/pages/designer/DesignerUploadPage.tsx`
  - `src/contexts/DesignerContext.tsx`
  - `src/pages/designer/DesignerProjectsPage.tsx`
  - `tests/auth-registration-persistence.spec.ts`
  - `docs/plans/2026-03-16-edit-project-redesign-design.md`
  - `docs/plans/2026-03-16-edit-project-redesign-implementation.md`
- 本地验证：
  - `npm --prefix server run build` 通过
  - `npx playwright test tests/auth-registration-persistence.spec.ts -g "edit project shows incomplete submission status with explicit missing fields" --workers=1` 通过
  - `npx playwright test tests/auth-registration-persistence.spec.ts -g "designer project survives logout and login again|designer project with a heavy gallery survives a My Projects refresh|new draft stays on an edit route and survives refresh" --workers=1` 通过
- 备注：`npm run build` 在当前机器因 `dist` 目录链接环境异常失败（`ENOENT mkdir dist`），非本轮业务逻辑编译错误。
- 发布状态：未上线

### 2026-03-16 设计师项目链路承接验证

- 承接上轮设计师项目修复后，按本地环境重新执行上传/刷新持久化回归。
- 本轮未发现新的业务回归，`projectController` 现有修复在本地可稳定通过门禁。
- 本地验证：
  - `npm --prefix server run build` 通过
  - `npx playwright test tests/auth-registration-persistence.spec.ts -g "designer project survives logout and login again|designer project with a heavy gallery survives a My Projects refresh|new draft stays on an edit route and survives refresh" --workers=1` 通过
- 发布状态：未上线

### 2026-03-14

- 已确认：设计师上传多图项目后，项目并没有丢，数据库里存在；真正失败的是刷新 `My Projects` 时 `/api/projects/my` 在 MySQL 侧触发 `ER_OUT_OF_SORTMEMORY`。
- 本地修复文件：
  - `server/src/controllers/projectController.ts`
  - `tests/auth-registration-persistence.spec.ts`
- 本地验证：
  - `npm --prefix server run build` 通过
  - `npx playwright test tests/auth-registration-persistence.spec.ts --workers=1` 通过
- 发布状态：未上线

- 已确认：线上上传项目报错并非图片超标，而是后端项目入库时把 `undefined` 传给 MySQL。
- 本地修复文件：
  - `server/src/controllers/projectController.ts`
  - `server/src/lib/projectPersistence.ts`
  - `server/src/lib/projectPersistence.test.ts`
- 本地验证：
  - `npm --prefix server run build` 通过
  - `node --test dist/lib/projectPersistence.test.js dist/lib/requestLimits.test.js dist/lib/registerEmailPolicy.test.js dist/lib/adminDesignersQuery.test.js` 通过
  - `npm run build` 通过
- 发布状态：未上线

### 2026-03-14 上传交互框架补充

- 已新增上传浮层提示：
  - Duplicate images skipped
  - Upload batch is too large
  - Project gallery is still too heavy
  - Images could not be prepared
- 已移除“Added N images”这种低价值成功提示，上传成功默认静默
- 已将压缩阈值提升到 `5MB`，超过即自动优化
- 已新增自动化门禁：
  - `tests/auth-registration-persistence.spec.ts`
  - 覆盖“重复图片被强提示且图库保持唯一”
- 本地验证：
  - `npx playwright test tests/auth-registration-persistence.spec.ts -g "duplicate gallery images trigger a visible upload warning and stay unique" --workers=1` 通过
  - `npm run build` 通过
- 发布状态：未上线

### 2026-03-14 表单输入规范补充

- 已新增统一规则文件：
  - `src/lib/formInputRules.ts`
- 已接入页面：
  - `src/pages/AuthPage.tsx`
  - `src/pages/designer/DesignerProfileEditPage.tsx`
  - `src/pages/designer/DesignerUploadPage.tsx`
  - `src/pages/RegisterPage.tsx`
  - `src/pages/SoftDecorationPage.tsx`
- 已新增自动化门禁：
  - `tests/auth-registration-persistence.spec.ts`
  - 覆盖“注册页 Phone / WhatsApp 过滤英文字母和特殊字符”
- 本地验证：
  - `npx playwright test tests/auth-registration-persistence.spec.ts -g "register phone field strips letters and special characters" --workers=1` 通过
  - `npm run build` 通过
- 发布状态：未上线

### 2026-03-14 My Projects 空态兜底补充

- 已修复：`My Projects` 页在无项目时，不再因为 `/projects/my` 拉取失败而直接显示红色错误块
- 当前行为：
  - 无项目：优先显示空态和 `Upload Your First Project`
  - 同步失败：只显示辅助说明，不挡操作
  - 有项目但刷新失败：继续显示现有项目，并补一条同步提醒
- 已新增自动化门禁：
  - `tests/auth-registration-persistence.spec.ts`
  - 覆盖“项目同步失败时仍显示空态和上传入口”
- 本地验证：
  - `npx playwright test tests/auth-registration-persistence.spec.ts -g "my projects keeps the upload empty state visible when project sync fails" --workers=1` 通过
  - `npm run build` 通过
- 发布状态：未上线

### 2026-03-14 注册登录补充

- 已确认：本地 `http://127.0.0.1:5173` 登录/注册报 `Network error` 的根因是后端 CORS 只放行了 `localhost`，没有放行 `127.0.0.1`。
- 本地修复文件：
  - `server/src/lib/corsOrigins.ts`
  - `server/src/lib/corsOrigins.test.ts`
  - `server/src/app.ts`
- 本地验证：
  - `npm --prefix server run build` 通过
  - 浏览器自动化实测完成注册和登录，最终到达 `/designer/dashboard`
- 测试账号：`qa.login.1773474833039@example.com`
- 发布状态：未上线

### 2026-03-14 注册重号与持久化门禁补充

- 已新增后端接口：`POST /api/auth/check-availability`
- 已新增前端行为：
  - 邮箱 blur 后即时检查是否已注册
  - 手机号 blur 后即时检查是否已注册
- 已新增自动化门禁：
  - `tests/auth-registration-persistence.spec.ts`
  - 覆盖“重号提示”和“注册 -> 上传项目 -> 退出 -> 再登录 -> 项目仍在”
- 本地验证：
  - `node --test dist/lib/registrationAvailability.test.js dist/lib/corsOrigins.test.js dist/lib/projectPersistence.test.js dist/lib/requestLimits.test.js` 通过
  - `npx playwright test tests/auth-registration-persistence.spec.ts --workers=1` 通过
- 发布状态：未上线

## 资深测试小明的强制验收门

以后涉及注册、登录、设计师上传，资深测试小明不得只做页面点点看，必须至少跑：

1. 注册页邮箱重号提示
2. 注册页手机号重号提示
3. 新账号注册成功
4. 验证后登录成功
5. 设计师上传项目成功
6. 同一张图片重复选择时不会重复加入，并能看到 duplicate 提示
7. 同一张图片重复选择时，必须出现明确的浮层/弹出式警告，不得只显示弱提示文案
7. 退出后重新登录
8. 项目列表仍然存在刚上传的项目

如果以上任一项未验证，不得给出“通过”结论。

## 使用说明

- 开始新任务前，先读本文件，确认当前规则和待办。
- 如果上下文丢失，优先以本文件为准继续推进。
- 如果用户改变流程或优先级，先改本文件，再继续执行。
