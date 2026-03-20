#!/bin/bash
# Tarmeer项目上传测试执行脚本

echo "🧪 Tarmeer设计师发作品流程测试"
echo "================================"
echo ""

# 检查依赖
echo "📋 检查测试环境..."
if ! command -v npx &> /dev/null; then
    echo "❌ npx 未安装"
    exit 1
fi

if [ ! -d "node_modules/playwright" ]; then
    echo "❌ Playwright 未安装"
    echo "运行: npm install"
    exit 1
fi

echo "✅ 测试环境检查完成"
echo ""

# 启动开发服务器
echo "🚀 启动开发服务器..."
npm run dev > /tmp/tarmeer-dev.log 2>&1 &
DEV_PID=$!
echo "✅ 开发服务器已启动 (PID: $DEV_PID)"

# 等待服务器启动
echo "⏳ 等待服务器启动..."
sleep 8

# 检查服务器是否运行
if ! curl -s http://127.0.0.1:5173 > /dev/null; then
    echo "❌ 服务器启动失败"
    cat /tmp/tarmeer-dev.log
    exit 1
fi

echo "✅ 服务器运行正常"
echo ""

# 运行测试
echo "🧪 运行测试套件..."
echo ""

# 运行基础测试
echo "1️⃣ 运行基础页面测试..."
npx playwright test tests/test-upload.spec.ts --reporter=line

if [ $? -eq 0 ]; then
    echo "✅ 基础测试通过"
else
    echo "❌ 基础测试失败"
fi

echo ""

# 运行简化版测试
echo "2️⃣ 运行简化版UI测试..."
npx playwright test tests/project-upload-simple.spec.ts --reporter=line

if [ $? -eq 0 ]; then
    echo "✅ 简化版测试通过"
else
    echo "❌ 简化版测试失败"
fi

echo ""

# 清理
echo "🧹 清理进程..."
kill $DEV_PID 2>/dev/null
echo "✅ 开发服务器已停止"
echo ""

echo "📊 测试完成！"
echo "查看详细报告: npx playwright show-report"
echo "查看截图: ls -la test-results/"
