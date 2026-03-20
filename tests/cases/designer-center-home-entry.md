# 设计师个人中心 Home 入口去重 - 测试用例

## TC-DC-001 页面头部无重复 Home

- 前置条件：
  - 使用设计师账号登录成功
  - 可访问 `/designer/dashboard`
- 步骤：
  1. 打开 `/designer/dashboard`
  2. 检查页面右上角操作区
  3. 检查左侧边栏底部区域
- 预期结果：
  - 右上角不再显示 `Home` 按钮
  - 左侧边栏仍显示 `Back to Home`
  - 头像与 `Log out` 按钮正常显示

## TC-DC-002 返回首页入口可用

- 前置条件：
  - 已进入设计师后台任意页面（`/designer/dashboard`、`/designer/projects`、`/designer/profile`）
- 步骤：
  1. 点击侧边栏 `Back to Home`
  2. 观察页面跳转与加载
- 预期结果：
  - 跳转到 `/`
  - 首页加载成功，无 404/白屏

## TC-DC-003 响应式下入口行为一致

- 前置条件：
  - 已登录设计师账号
- 步骤：
  1. 在桌面宽度（>=1024px）访问 `/designer/dashboard`
  2. 在移动宽度（<768px）访问 `/designer/dashboard`
- 预期结果：
  - 桌面端：右上角无重复 `Home`，侧栏显示 `Back to Home`
  - 移动端：顶部无重复 `Home` 文案入口
