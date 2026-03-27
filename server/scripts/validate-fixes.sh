#!/bin/bash
# 快速验证修复脚本
# 检查所有必要的文件和代码变更

echo "🔍 Tarmeer 头像和后台修复验证"
echo "================================"
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0

check_file() {
    local file=$1
    local description=$2

    if [ -f "$file" ]; then
        echo "✓ $description: $file"
        ((SUCCESS_COUNT++))
        return 0
    else
        echo "✗ $description: $file (未找到)"
        ((FAIL_COUNT++))
        return 1
    fi
}

check_code() {
    local file=$1
    local pattern=$2
    local description=$3

    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo "✓ $description"
        ((SUCCESS_COUNT++))
        return 0
    else
        echo "✗ $description (未找到)"
        ((FAIL_COUNT++))
        return 1
    fi
}

echo "📋 检查必要文件..."
echo "--------------------"

check_file "server/schema/migration-2026-03-23-fix-image-fields.sql" "图像字段迁移脚本"
check_file "server/schema/migration-2026-03-23-fix-designer-status.sql" "设计师状态迁移脚本"
check_file "server/scripts/apply-migration.sh" "迁移执行脚本"
check_file "server/scripts/verify-schema.sh" "Schema验证脚本"
check_file "server/scripts/check-registrations.sh" "注册检查脚本"
check_file "tests/manual/test-fixes.md" "测试计划文档"

echo ""
echo "📝 检查代码变更..."
echo "--------------------"

check_code "server/src/controllers/authController.ts" "status, is_approved" "注册时明确设置status字段"
check_code "deploy-simple.sh" "verify-schema.sh" "部署脚本包含schema验证"
check_code "server/schema/migration-2026-03-23-fix-image-fields.sql" "MEDIUMTEXT" "迁移脚本升级avatar_url字段"
check_code "server/schema/migration-2026-03-23-fix-designer-status.sql" "DEFAULT 'pending'" "迁移脚本设置正确的默认值"

echo ""
echo "🔍 检查脚本权限..."
echo "--------------------"

for script in server/scripts/*.sh; do
    if [ -x "$script" ]; then
        echo "✓ $(basename $script) 有执行权限"
        ((SUCCESS_COUNT++))
    else
        echo "⚠ $(basename $script) 缺少执行权限"
        ((FAIL_COUNT++))
    fi
done

echo ""
echo "================================"
echo "✅ 检查完成"
echo "成功: $SUCCESS_COUNT 项"
echo "失败: $FAIL_COUNT 项"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo "🎉 所有检查通过！可以继续部署测试"
    exit 0
else
    echo "⚠️  发现 $FAIL_COUNT 个问题，请先修复"
    exit 1
fi
