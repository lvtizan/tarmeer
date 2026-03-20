# Tarmeer 测试用例目录

本目录用于统一管理手工测试用例与回归检查清单。

## 结构约定

- 一个场景一个文件，文件名使用 `kebab-case`
- 每条用例包含：编号、前置条件、步骤、预期结果
- 自动化测试（`tests/*.spec.ts`）不迁移，只在这里建立映射

## 用例清单

- `designer-center-home-entry.md`  
  设计师个人中心「Home 入口去重」验证
- `deploy-incremental-only.md`  
  生产部署「仅增量 rsync」验证
- `smoke-regression-core.md`  
  核心回归冒烟（发布前最小检查）

## 自动化测试映射

- 认证流程：`tests/auth-flow.spec.ts`
- 注册持久化：`tests/auth-registration-persistence.spec.ts`
- 设计师种子数据：`tests/designers-seed.spec.ts`
- 作品上传：`tests/project-upload.spec.ts`
- 作品上传简版：`tests/project-upload-simple.spec.ts`
- 图片加载：`tests/image-test.spec.ts`
