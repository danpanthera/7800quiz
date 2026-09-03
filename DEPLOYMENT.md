# 7800Quiz — Hướng dẫn Triển khai Nội bộ

Portal web responsive (không còn app điện thoại riêng) — chạy trên Windows Server nội bộ ngân hàng, truy cập qua domain `quiz.vbalaichau.com` từ mọi thiết bị (phone/tablet/PC) qua trình duyệt.

## Mục lục
1. [Kiến trúc triển khai](#kien-truc)
2. [Trỏ DNS cho quiz.vbalaichau.com](#dns)
3. [Mở port trên Router & Windows Firewall](#firewall)
4. [Cài Nginx + Certbot trên Windows Server](#nginx-certbot)
5. [Cấu hình Nginx](#nginx-config)
6. [Tự động gia hạn SSL cert](#ssl-renew)
7. [Deploy ứng dụng với Docker Compose](#deploy)
8. [Checklist triển khai Production](#checklist)

---

## 1. Kiến trúc triển khai {#kien-truc}

**Mô hình**: ngân hàng đã có domain riêng (`vbalaichau.com`, cùng convention với project Khoan → `khoan.vbalaichau.com`) — dùng subdomain **`quiz.vbalaichau.com`** trỏ thẳng về máy Windows Server, + Let's Encrypt SSL (miễn phí).

```
Trình duyệt (phone/tablet/PC, mọi mạng)
        │  HTTPS
        ▼
  quiz.vbalaichau.com:443
        │  Nginx reverse proxy (Windows)
  ├──► localhost:13010  (API NestJS + Socket.IO/Arena, Docker)
  └──► localhost:15173  (Web portal, Docker/Nginx trong container)
```

`docker-compose.yml` chỉ expose port `13010` và `15173` ra `localhost` — Nginx (Windows, chạy trực tiếp trên máy chủ) là điểm vào duy nhất từ internet.

---

## 2. Trỏ DNS cho quiz.vbalaichau.com {#dns}

1. Vào DNS management của `vbalaichau.com` (nhờ IT/nhà cung cấp domain)
2. Tạo **A record**: `quiz` → IP public của máy Windows Server (tĩnh)
3. Chờ DNS propagate (vài phút tới vài giờ), kiểm tra: `dig +short quiz.vbalaichau.com` hoặc `nslookup quiz.vbalaichau.com`

> **Nếu IP public không tĩnh**: dùng CNAME trỏ `quiz.vbalaichau.com` → 1 hostname DuckDNS (`quiz7800.duckdns.org`) rồi để DuckDNS client tự cập nhật IP:
> ```bat
> REM C:\duckdns\update.bat — chỉ cần nếu dùng phương án CNAME dự phòng ở trên
> curl "https://www.duckdns.org/update?domains=quiz7800&token=YOUR_TOKEN&ip=" -o C:\duckdns\duck.log
> ```
> Task Scheduler chạy mỗi 5 phút (`Trigger: Repeat every 5 minutes, indefinitely`, `Run as: SYSTEM`).

---

## 3. Mở port trên Router & Windows Firewall {#firewall}

**Router** (port forwarding): nhờ IT network

| Port ngoài | Forward vào | Dùng cho |
|-----------|-------------|---------|
| `80` | `192.168.x.x:80` | Let's Encrypt challenge |
| `443` | `192.168.x.x:443` | HTTPS (API + Web) |

**Windows Firewall** (chạy PowerShell với quyền Admin):
```powershell
New-NetFirewallRule -DisplayName "HTTP 80" -Direction Inbound -Port 80 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "HTTPS 443" -Direction Inbound -Port 443 -Protocol TCP -Action Allow
```

---

## 4. Cài Nginx + Certbot trên Windows Server {#nginx-certbot}

**Nginx**: tải từ [nginx.org/en/download.html](http://nginx.org/en/download.html) → giải nén vào `C:\nginx`

**Certbot** (Let's Encrypt): tải từ [certbot.eff.org](https://certbot.eff.org/instructions?system=windows)

Lấy SSL cert:
```cmd
certbot certonly --webroot -w C:\nginx\html -d quiz.vbalaichau.com
REM Cert lưu tại: C:\Certbot\live\quiz.vbalaichau.com\
```

---

## 5. Cấu hình Nginx {#nginx-config}

File `C:\nginx\conf\nginx.conf`:
```nginx
# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name quiz.vbalaichau.com;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root C:/nginx/html;
    }
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl;
    server_name quiz.vbalaichau.com;

    ssl_certificate     C:/Certbot/live/quiz.vbalaichau.com/fullchain.pem;
    ssl_certificate_key C:/Certbot/live/quiz.vbalaichau.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # API (REST — dưới prefix /api/)
    location /api/ {
        proxy_pass http://localhost:13010/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_http_version 1.1;
    }

    # Socket.IO (Arena real-time) — NestJS IoAdapter gắn ở ROOT path,
    # NGOÀI prefix /api (app.setGlobalPrefix('api') chỉ áp dụng cho REST
    # controller, không áp dụng cho WebSocket Gateway). Thiếu location này
    # thì request /socket.io/ rơi vào block `location /` bên dưới (proxy
    # sang Web portal) → Arena không kết nối được ở production.
    location /socket.io/ {
        proxy_pass http://localhost:13010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Web portal
    location / {
        proxy_pass http://localhost:15173/;
        proxy_set_header Host $host;
    }
}
```

Khởi động Nginx (chạy CMD với quyền Admin):
```cmd
cd C:\nginx
nginx.exe
REM Kiểm tra:  nginx.exe -t
REM Reload:    nginx.exe -s reload
REM Stop:      nginx.exe -s stop
```

Đặt Nginx chạy tự động khi khởi động Windows bằng NSSM (Non-Sucking Service Manager):
```cmd
nssm install nginx C:\nginx\nginx.exe
nssm start nginx
```

---

## 6. Tự động gia hạn SSL cert {#ssl-renew}

Let's Encrypt cert hết hạn sau 90 ngày. Đặt Task Scheduler gia hạn tự động mỗi tháng:
```
Action: certbot renew --quiet
Trigger: Monthly, ngày 1 lúc 03:00
Run as: SYSTEM
```

---

## 7. Deploy ứng dụng với Docker Compose {#deploy}

```cmd
cd C:\7800quiz

REM Lần đầu — build + migrate + seed
docker compose up -d --build
docker exec quiz7800_api npx prisma migrate deploy
docker exec quiz7800_api npm run seed

REM Cập nhật sau này
git pull
docker compose up -d --build
docker exec quiz7800_api npx prisma migrate deploy
```

File `.env` production (`apps/api/.env`, không commit — xem `.gitignore`):
```env
DATABASE_URL="postgresql://postgres:<mat-khau-manh>@postgres:5432/quiz7800?schema=public"
JWT_SECRET="<chuoi-ngau-nhien-toi-thieu-48-byte>"
JWT_EXPIRES_IN="8h"
PORT=13010
```

---

## 8. Checklist triển khai Production {#checklist}

- [ ] Đổi `JWT_SECRET` thành chuỗi ngẫu nhiên ≥ 48 byte, đổi `POSTGRES_PASSWORD` khỏi giá trị dev mặc định
- [ ] Cấu hình PostgreSQL production (Docker Compose, volume lưu ngoài container)
- [ ] Cấu hình HTTPS cho domain — **bao gồm location `/socket.io/` với header Upgrade** cho Arena (mục 5), thiếu block này Arena không kết nối được ở production
- [ ] `docker compose up -d --build` + `prisma migrate deploy` + `npm run seed`
- [ ] Test end-to-end qua trình duyệt trên phone/tablet/PC thật: đăng nhập → đổi mật khẩu lần đầu → làm bài kiểm tra → xem kết quả → Arena real-time (host + người chơi)
