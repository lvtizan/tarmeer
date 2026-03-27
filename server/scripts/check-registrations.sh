#!/bin/bash
# 检查线上数据库中的设计师注册情况
# 用法：ssh到服务器执行此脚本

echo "🔍 检查设计师注册情况"
echo "======================"
echo ""

# 数据库配置（从.env读取或使用默认值）
if [ -f ".env" ]; then
    source .env
    DB_HOST=${DB_HOST:-"localhost"}
    DB_USER=${DB_USER:-"root"}
    DB_PASS=${DB_PASSWORD:-""}
    DB_NAME=${DB_NAME:-"tarmeer"}
else
    echo "❌ 找不到.env文件"
    exit 1
fi

echo "1. 检查最近注册的设计师（按注册时间倒序）"
echo "----------------------------------------"
mysql -h"${DB_HOST}" -u"${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" -e "
SELECT
    id,
    email,
    full_name,
    status,
    is_approved,
    email_verified,
    deleted_at,
    created_at
FROM designers
ORDER BY created_at DESC
LIMIT 10;
" 2>/dev/null

echo ""
echo "2. 统计各状态设计师数量"
echo "------------------------"
mysql -h"${DB_HOST}" -u"${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" -e "
SELECT
    status,
    is_approved,
    COUNT(*) as count,
    MIN(created_at) as earliest,
    MAX(created_at) as latest
FROM designers
GROUP BY status, is_approved
ORDER BY status;
" 2>/dev/null

echo ""
echo "3. 检查是否有pending状态的设计师"
echo "--------------------------------"
mysql -h"${DB_HOST}" -u"${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" -e "
SELECT
    id,
    email,
    full_name,
    city,
    phone,
    status,
    is_approved,
    created_at
FROM designers
WHERE status = 'pending'
  AND deleted_at IS NULL
ORDER BY created_at DESC;
" 2>/dev/null

echo ""
echo "4. 检查字段类型（确认schema）"
echo "----------------------------"
mysql -h"${DB_HOST}" -u"${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" -e "
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = '${DB_NAME}'
  AND TABLE_NAME = 'designers'
  AND COLUMN_NAME IN ('status', 'is_approved', 'avatar_url')
ORDER BY COLUMN_NAME;
" 2>/dev/null

echo ""
echo "5. 检查是否有注册失败的日志"
echo "----------------------------"
echo "（需要查看应用日志，这里只提供命令）"
echo "tail -100 /tarmeer/tarmeer_api/logs/*.log | grep -i 'register\|error'"

echo ""
echo "======================"
echo "✅ 检查完成"
echo ""
echo "如果看到pending状态的设计师，说明注册成功，问题可能在后台查询逻辑"
echo "如果没有pending设计师，可能是注册失败或状态设置有问题"
