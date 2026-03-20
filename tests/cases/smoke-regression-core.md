# 核心回归冒烟 - 测试用例

## 执行命令

```bash
npm run qa:smoke
```

## TC-SM-001 前端类型检查

- 步骤：
  1. 执行 `npm run qa:smoke`
- 预期结果：
  - `npx tsc --noEmit` 通过
  - 无 TypeScript 编译错误

## TC-SM-002 前端构建可用

- 步骤：
  1. 观察 `qa:smoke` 中 build 阶段输出
- 预期结果：
  - `npm run build` 成功，或出现脚本已定义的 `dist symlink` 兼容提示
  - 无其他构建失败异常

## TC-SM-003 后端单测与构建

- 步骤：
  1. 观察 `qa:smoke` 第 3 步输出
- 预期结果：
  - `server npm run test` 通过

## TC-SM-004 手工检查提醒完整

- 步骤：
  1. 查看 `qa:smoke` 最后一段输出
- 预期结果：
  - 包含登录成功/失败反馈检查
  - 包含注册校验状态检查
  - 包含 `localhost/127.0.0.1` API 路径检查
