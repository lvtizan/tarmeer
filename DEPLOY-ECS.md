# 部署到 ECS 服务器

## 服务器信息

- **IP**: 47.91.108.104  
- **账号**: root  
- **SSH 端口**: 22  
- **部署目录**: /tarmeer/tarmeer_web_portal  

## 方式一：在终端运行脚本（会提示输入密码）

在项目目录下执行：

```bash
cd "/Users/kp/Library/Mobile Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0"
./deploy-ecs.sh
```

出现 SSH 密码提示时，输入服务器密码即可。

## 方式二：配置 SSH 免密后一键部署

1. 生成密钥（如还没有）：
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/tarmeer_ecs -N ""
   ```

2. 把公钥拷到服务器（会要求输入一次密码）：
   ```bash
   ssh-copy-id -i ~/.ssh/tarmeer_ecs.pub -p 22 root@47.91.108.104
   ```

3. 之后直接运行部署脚本，无需再输入密码：
   ```bash
   ./deploy-ecs.sh
   ```

## 方式三：手动命令

```bash
cd "/Users/kp/Library/Mobile Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0"
npm run build
ssh -p 22 root@47.91.108.104 "mkdir -p /tarmeer/tarmeer_web_portal"
rsync -avz --delete -e "ssh -p 22" dist/ root@47.91.108.104:/tarmeer/tarmeer_web_portal/
```

## 服务器端：用 Nginx 提供访问

部署完成后，需要在 ECS 上配置 Web 服务器（如 Nginx）把站点指到 `/tarmeer/tarmeer_web_portal`，并配置 SPA 回退到 `index.html`。例如：

```nginx
server {
    listen 80;
    server_name 47.91.108.104;  # 或你的域名
    root /tarmeer/tarmeer_web_portal;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

重载 Nginx 后即可通过 IP 或域名访问。
