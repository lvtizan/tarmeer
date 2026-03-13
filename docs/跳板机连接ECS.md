# 从跳板机连接到 ECS

跳板机地址：**https://jump.kuaipicloud.com/**

以下为常见方式，具体以你们公司实际界面为准；若不明确可问运维要「从跳板机登录 ECS」的说明。

---

## 方式一：网页里直接选 ECS（常见）

1. 浏览器打开 https://jump.kuaipicloud.com/
2. 用账号密码登录（如 lvyiming / 对应密码）
3. 登录后一般会看到 **主机列表** 或 **服务器列表**
4. 找到 **Tarmeer 的 ECS**（可能显示为 47.91.108.104 或主机名，如 iZeb35rspgl6ip0j4gpcajZ）
5. 点击该主机，会打开一个 **终端窗口**，此时已经是 ECS 的 shell，可直接执行命令（如改 .env、pm2 等）

---

## 方式二：先登录跳板机，再 SSH 到 ECS

若跳板机是台 Linux 主机，需要两步：

1. **登录跳板机**  
   - 浏览器：在跳板机网页里选「跳板机」或「堡垒机」主机，进入终端；  
   - 或本机终端：`ssh 用户名@跳板机地址`（具体地址、用户名问运维）

2. **在跳板机终端里连 ECS**  
   ```bash
   ssh root@47.91.108.104
   ```  
   若 ECS 只允许内网 IP，跳板机会给出 ECS 的**内网 IP** 或主机名，例如：  
   ```bash
   ssh root@ecs内网IP
   ```  
   按运维提供的为准。

3. 输入 ECS 的 root 密码（或使用已配置的密钥）后，即进入 ECS，可执行：  
   ```bash
   cd /tarmeer/tarmeer_api
   # 后续改 .env、pm2 restart 等
   ```

---

## 方式三：本机直连 ECS（不经过跳板机）

若公司允许从本机直连 ECS 公网 IP，且已放行 22 端口：

```bash
ssh root@47.91.108.104
```

输入 ECS 的 root 密码即可。若不允许或连不上，就用方式一或方式二经跳板机连接。

---

## 连接上 ECS 后：改 SMTP 并重启后端

在 ECS 终端里执行（整段复制粘贴）：

```bash
cd /tarmeer/tarmeer_api && sed -i '/^SMTP_/d' .env && cat >> .env << 'ENVEOF'

# SMTP 阿里云邮件推送
SMTP_HOST=smtpdm.aliyun.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@mail.kptom.com
SMTP_PASS=KPbec9f642d822488b
SMTP_FROM=noreply@mail.kptom.com
ENVEOF
grep '^SMTP_' .env && pm2 restart tarmeer-api && echo Done.
```

---

若你们跳板机界面和上述不一致，把登录后看到的菜单/主机列表描述一下（或截图给运维），我可以按实际界面改成更贴合的步骤说明。
