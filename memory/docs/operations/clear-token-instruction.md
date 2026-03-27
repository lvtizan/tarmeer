# 清除Token并重新登录的步骤

## 方法1：使用浏览器控制台（最可靠）

1. 打开 https://www.tarmeer.com
2. 按 F12 打开开发者工具
3. 进入 Console（控制台）标签
4. 粘贴以下代码并按回车：

```javascript
// 检查当前token
const currentToken = localStorage.getItem('token');
console.log('Current token:', currentToken ? currentToken.substring(0, 50) + '...' : 'NO TOKEN');

// 清除token
localStorage.removeItem('token');
console.log('✅ Token已清除');

// 清除其他可能的存储
localStorage.clear();
console.log('✅ 所有localStorage已清除');

// 刷新页面
console.log('🔄 正在刷新页面...');
setTimeout(() => location.reload(), 1000);
```

5. 页面会自动刷新
6. 重新登录
7. 测试头像上传功能

---

## 方法2：手动清除

1. 按 F12 打开开发者工具
2. 进入 **Application**（应用）标签
3. 左侧找到 **Local Storage**
4. 点击 `https://www.tarmeer.com`
5. 删除所有项目（特别是 `token`）
6. 刷新页面并重新登录

---

## 方法3：使用无痕模式（最简单）

1. 打开浏览器的无痕/隐私模式：
   - Chrome: Ctrl+Shift+N (Windows) 或 Cmd+Shift+N (Mac)
   - Firefox: Ctrl+Shift+P (Windows) 或 Cmd+Shift+P (Mac)
   - Safari: Cmd+Shift+N (Mac)
2. 访问 https://www.tarmeer.com
3. 登录账号
4. 测试功能

---

## 验证Token是否有效

登录后，在控制台执行：

```javascript
// 检查新token
const newToken = localStorage.getItem('token');
console.log('New token:', newToken ? 'EXISTS' : 'MISSING');

// 尝试访问API
fetch('/api/projects/my', {
  headers: {
    'Authorization': 'Bearer ' + newToken
  }
})
.then(r => {
  console.log('API Status:', r.status);
  return r.json();
})
.then(data => console.log('API Response:', data))
.catch(err => console.error('API Error:', err));
```

如果返回 200，说明token有效！
