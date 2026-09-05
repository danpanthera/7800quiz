# 7800Quiz — Lộ trình triển khai Production (từ A đến Z)

Tài liệu này dẫn **từng bước một, theo đúng thứ tự**, để đưa 7800Quiz từ máy dev lên một máy chủ **Windows Server** thật, phục vụ toàn bộ 9 chi nhánh qua domain `quiz.vbalaichau.com`. Làm tuần tự từ Giai đoạn 0, đánh dấu ô checklist khi xong mỗi bước — không cần hiểu sâu Docker/Linux để làm theo được.

> **Phạm vi**: tài liệu này chỉ áp dụng cho **Windows Server 2019/2022**.

---

## Giai đoạn 0 — Tổng quan & quyết định trước khi bắt đầu

### 0.1. Kiến trúc hệ thống sẽ có

```
Internet → quiz.vbalaichau.com :443
              │
        ┌─────▼─────┐  quiz7800_proxy (Caddy — tự xin & tự gia hạn HTTPS)
        │   Caddy   │
        └──┬─────┬──┘
   /api/*  │     │  /socket.io/*        (mọi đường dẫn còn lại)
           ▼     ▼                              ▼
     quiz7800_api:13010                  quiz7800_web:80
     (NestJS + Socket.IO)                (giao diện web)
              │
              ▼
        quiz7800_db (PostgreSQL, không mở ra ngoài)
```

4 container chạy bằng Docker, khởi động cùng lúc bằng một lệnh. **Caddy là cửa duy nhất** nhận traffic từ Internet — không cần cài Nginx, Certbot hay IIS trên Windows.

> **Ghi nhớ**: hệ thống chỉ chạy đúng **1 bản API** (không nhân bản/scale ra nhiều instance). Đấu trường (Socket.IO) và bộ đếm giờ tự nộp bài đều giả định chỉ có một tiến trình API duy nhất.

### 0.2. Docker Desktop hay Docker Engine trong máy ảo Linux?

| Phương án | Ưu điểm | Nhược điểm |
|---|---|---|
| **Docker Desktop** (cài trực tiếp lên Windows) | Cài đặt nhanh, có giao diện | Cần **giấy phép trả phí** nếu ngân hàng >250 nhân viên hoặc doanh thu >10 triệu USD/năm (rất có thể đúng với Agribank — cần xác nhận với phòng mua sắm/CNTT trước). Ngoài ra **không tự khởi động lại** sau khi máy chủ reboot cho tới khi có người đăng nhập — rủi ro thật nếu máy tự khởi động lại lúc nửa đêm |
| **Docker Engine trong máy ảo Ubuntu** (Hyper-V, khuyến nghị) | Miễn phí hoàn toàn (Apache 2.0), tự khởi động cùng máy chủ nhờ `systemd`, không cần ai đăng nhập | Cần cài thêm một máy ảo (mất ~15 phút) |

**Khuyến nghị: dùng máy ảo Ubuntu qua Hyper-V.** Toàn bộ lệnh Docker trong tài liệu này giống hệt nhau dù chạy trên máy ảo Linux hay Docker Desktop — chỉ khác cách cài đặt ở Giai đoạn 2. Nếu ngân hàng đã có sẵn giấy phép Docker Desktop hợp lệ, dùng thẳng Docker Desktop cũng được, chỉ cần lưu ý cấu hình để nó tự khởi động (xem Giai đoạn 1.4).

### 0.3. Checklist chuẩn bị trước khi bắt tay vào làm

Thu thập trước những thứ sau — thiếu cái nào thì dừng ở đúng bước cần nó, không phải làm lại từ đầu:

- [ ] Máy chủ Windows Server 2019/2022: tối thiểu 4 core CPU, 8GB RAM, 100GB ổ đĩa (ưu tiên SSD), có kết nối Internet (xem 0.4)
- [ ] IP public tĩnh của máy chủ (hoặc phương án IP động — xem ghi chú ở Giai đoạn 8)
- [ ] Người/bộ phận có quyền forward port 80 + 443 trên router/thiết bị biên về máy chủ
- [ ] Người/bộ phận quản lý DNS của `vbalaichau.com` để tạo bản ghi A cho `quiz`
- [ ] Một email nội bộ CNTT để nhận cảnh báo khi chứng chỉ HTTPS sắp hết hạn
- [ ] Xác nhận với phòng mua sắm/pháp chế về giấy phép Docker Desktop nếu chọn phương án đó thay vì máy ảo Ubuntu

### 0.4. Máy chủ có ra được Internet không?

Cần xác nhận 3 chiều kết nối sau — thiếu một trong ba thì phải đổi phương án ở đúng giai đoạn liên quan:

1. **Internet → máy chủ, cổng 80 + 443**: bắt buộc để Let's Encrypt xác thực domain (Giai đoạn 8). Nếu ngân hàng chỉ cho mạng nội bộ, phải dùng chứng chỉ nội bộ thay Let's Encrypt (xem ghi chú cuối Giai đoạn 8).
2. **Máy chủ → Internet, cổng 443**: cần để Let's Encrypt cấp/gia hạn chứng chỉ và để `npm`/Docker tải image lúc build (Giai đoạn 5).
3. Nếu máy chủ **hoàn toàn không ra Internet được**: phải build image ở một máy có mạng rồi mang file `.tar` sang bằng `docker save` / `docker load` — báo lại nếu rơi vào trường hợp này để có hướng dẫn riêng.

---

## Giai đoạn 1 — Chuẩn bị hệ điều hành máy chủ

### 1.1. Kiểm tra phiên bản Windows

```powershell
Get-ComputerInfo | Select-Object OsName, OsVersion, OsHardwareAbstractionLayer
```

### 1.2. Bật vai trò Hyper-V (nếu dùng phương án máy ảo Ubuntu — khuyến nghị)

```powershell
Install-WindowsFeature -Name Hyper-V -IncludeManagementTools -Restart
```

### 1.3. Đồng bộ đồng hồ hệ thống

Đồng hồ sai làm JWT bị từ chối sớm và khiến việc xác thực chứng chỉ HTTPS thất bại.

```powershell
w32tm /query /status
w32tm /resync
```
(Nếu máy đã gia nhập domain của ngân hàng, nó tự đồng bộ theo domain controller — không cần đổi gì, chỉ cần xác nhận giờ đúng.)

### 1.4. Xác nhận máy chủ không tự ngủ/hibernate

Windows Server mặc định không tự ngủ, nhưng nếu máy chủ là phần cứng desktop được cài Windows Server (thường gặp ở các đơn vị nhỏ), driver quản lý nguồn của nhà sản xuất đôi khi vẫn đặt lịch standby. Kiểm tra và ép về chế độ không bao giờ ngủ cho chắc chắn — một máy chủ 24/7 bị ngủ giữa đêm là lỗi rất khó phát hiện kịp thời.

```powershell
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /hibernate off
```

### 1.5. Hoãn Windows Update tự khởi động lại

```powershell
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings' -Name 'ActiveHoursStart' -Value 6
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings' -Name 'ActiveHoursEnd'   -Value 22
```
Quy tắc vận hành: **không cập nhật Windows trong tuần diễn ra kỳ thi**, và sau **mỗi lần** máy khởi động lại (dù chủ động hay do Update), phải kiểm tra lại hệ thống theo Giai đoạn 12.

### 1.6. Loại trừ khỏi phần mềm diệt virus

Nếu máy có cài antivirus/EDR của ngân hàng, đề nghị bộ phận an ninh thông tin loại trừ khỏi quét realtime (tránh máy chậm nghiêm trọng hoặc khoá nhầm file dữ liệu):
`%ProgramData%\Docker`, `%LOCALAPPDATA%\Docker\wsl`, `C:\7800quiz`, `C:\7800quiz-backup`.

### ✅ Checklist Giai đoạn 1
- [ ] Xác nhận phiên bản Windows
- [ ] Hyper-V đã bật (nếu chọn phương án máy ảo)
- [ ] Đồng hồ hệ thống đúng
- [ ] Đã tắt Sleep/Hibernate/Fast Startup
- [ ] Đã cấu hình Active Hours
- [ ] Đã xin ngoại lệ antivirus (nếu áp dụng)

---

## Giai đoạn 2 — Cài đặt Docker

### Phương án A — Máy ảo Ubuntu qua Hyper-V (khuyến nghị)

1. Tải **Ubuntu Server 24.04 LTS** ISO.
2. Hyper-V Manager → New → Virtual Machine: tối thiểu 4GB RAM, 2 vCPU, 60GB ổ đĩa, gắn ISO, cài đặt như bình thường (đặt tên máy `quiz7800-host`, tạo user quản trị).
3. Trong VM Ubuntu, cài Docker Engine:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER
   sudo systemctl enable docker    # tự khởi động cùng máy, không cần đăng nhập
   ```
4. Đặt VM tự khởi động cùng Windows: Hyper-V Manager → chọn VM → Settings → Automatic Start Action → **Always start this virtual machine automatically**.
5. Trong Windows, forward port 80/443 vào IP của VM (xem Giai đoạn 3.3).

Từ đây, **mọi lệnh Docker trong tài liệu chạy bên trong VM Ubuntu này** (qua SSH hoặc Hyper-V console), cú pháp giống hệt PowerShell chỉ đổi thành bash — ví dụ `docker compose ...` giữ nguyên, chỉ bỏ tiền tố `powershell`.

### Phương án B — Docker Desktop trực tiếp trên Windows

1. Tải và cài [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. Chọn backend **WSL2** khi cài đặt.
3. Settings → General → bật **Start Docker Desktop when you sign in**.
4. ⚠️ Vì Docker Desktop cần phiên đăng nhập, cấu hình máy tự đăng nhập một tài khoản dịch vụ (netplwiz hoặc Sysinternals Autologon) — cần xác nhận với phòng an ninh thông tin trước vì autologon thường bị chính sách bảo mật hạn chế.

### Kiểm tra sau khi cài (áp dụng cho cả 2 phương án)

```powershell
docker version
docker compose version            # cần >= 2.20
docker info --format '{{.OSType}}'   # phải in ra: linux
```

Nếu dùng WSL2 (Phương án B), giới hạn RAM để tránh chiếm hết bộ nhớ máy — tạo `C:\Users\<tài-khoản>\.wslconfig`:
```ini
[wsl2]
memory=8GB
processors=4
swap=2GB
```

### ✅ Checklist Giai đoạn 2
- [ ] `docker version` chạy được, không lỗi
- [ ] `docker compose version` >= 2.20
- [ ] `docker info --format '{{.OSType}}'` in ra `linux`
- [ ] Đã xác nhận Docker tự khởi động lại sau khi reboot máy chủ (khởi động lại thử một lần để kiểm chứng)

---

## Giai đoạn 3 — Mở mạng

### 3.1. Mở Windows Firewall

```powershell
New-NetFirewallRule -DisplayName "7800Quiz HTTP 80"  -Direction Inbound -Protocol TCP -LocalPort 80  -Action Allow
New-NetFirewallRule -DisplayName "7800Quiz HTTPS 443" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

### 3.2. Kiểm tra port 80/443 chưa bị chương trình khác chiếm

```powershell
Get-NetTCPConnection -LocalPort 80,443 -State Listen -ErrorAction SilentlyContinue

# Hyper-V/WinNAT hay "giữ chỗ" dải port ngẫu nhiên, có thể nuốt mất 443
netsh interface ipv4 show excludedportrange protocol=tcp
```
Nếu IIS đang chiếm cổng:
```powershell
Stop-Service W3SVC -ErrorAction SilentlyContinue
Set-Service  W3SVC -StartupType Disabled -ErrorAction SilentlyContinue
```

### 3.3. Forward port trên router/thiết bị biên

Nhờ bộ phận quản lý mạng forward **cổng 80 và 443** từ IP public về đúng IP nội bộ của máy chủ (hoặc IP của VM Ubuntu nếu dùng Phương án A ở Giai đoạn 2). Port 80 **bắt buộc phải mở** — Let's Encrypt cần nó để xác thực quyền sở hữu domain ở Giai đoạn 8.

### ✅ Checklist Giai đoạn 3
- [ ] 2 rule Firewall đã tạo
- [ ] Port 80/443 không bị chương trình nào khác chiếm
- [ ] Đã xác nhận với bộ phận mạng: port 80 + 443 được forward về đúng máy chủ

---

## Giai đoạn 4 — Lấy mã nguồn & cấu hình bí mật

### 4.1. Clone mã nguồn

```powershell
# Bắt buộc làm TRƯỚC khi clone — tránh Git tự đổi LF thành CRLF
git config --global core.autocrlf false

Set-Location C:\
git clone https://github.com/danpanthera/7800quiz.git
Set-Location C:\7800quiz
```

### 4.2. Tạo file `.env.prod` chứa bí mật

```powershell
Copy-Item .env.prod.example .env.prod

# Sinh JWT_SECRET — chuỗi hex 64 ký tự (256 bit)
$jwt = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })

# Sinh mật khẩu PostgreSQL — CHỈ chữ và số.
# Không dùng Base64: ký tự "/" và "+" phá vỡ cú pháp DATABASE_URL của Prisma,
# ký tự "$" bị Docker Compose hiểu nhầm thành nội suy biến.
$pgpass = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

Write-Host "JWT_SECRET        = $jwt"
Write-Host "POSTGRES_PASSWORD = $pgpass"
notepad .env.prod
```

Trong Notepad, dán 2 giá trị vừa sinh vào đúng chỗ, và kiểm tra/sửa các dòng còn lại:

| Biến | Giá trị cần đặt |
|---|---|
| `SITE_ADDRESS` | `quiz.vbalaichau.com` |
| `ACME_EMAIL` | email CNTT nhận cảnh báo hết hạn chứng chỉ |
| `POSTGRES_USER`, `POSTGRES_DB` | giữ mặc định `quiz7800` là được |
| `POSTGRES_PASSWORD` | giá trị vừa sinh ở trên |
| `JWT_SECRET` | giá trị vừa sinh ở trên |
| `JWT_EXPIRES_IN` | giữ mặc định `8h` |
| `CORS_ORIGIN` | `https://quiz.vbalaichau.com` |
| `TZ` | giữ mặc định `Asia/Ho_Chi_Minh` |

**Lưu ngay 2 giá trị `JWT_SECRET` và `POSTGRES_PASSWORD` vào kho mật khẩu của phòng CNTT** — đây là bước dễ quên nhất và khó khôi phục nhất nếu mất.

> ⚠️ Đổi `POSTGRES_PASSWORD` **sau khi** đã chạy Giai đoạn 5 sẽ không có tác dụng (Postgres chỉ đặt mật khẩu lúc khởi tạo lần đầu) — kiểm tra kỹ giá trị này **trước khi** sang giai đoạn kế tiếp.

### 4.3. Xác nhận biến được đọc đúng

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod config | Select-String "DATABASE_URL","SITE_ADDRESS"
```
Phải thấy `DATABASE_URL` chứa đúng mật khẩu vừa đặt và `SITE_ADDRESS: quiz.vbalaichau.com`.

### ✅ Checklist Giai đoạn 4
- [ ] Mã nguồn đã clone vào `C:\7800quiz`
- [ ] File `.env.prod` đã tạo, mọi biến đã điền giá trị thật (không còn chữ `THAY_BANG_...`)
- [ ] `JWT_SECRET` và `POSTGRES_PASSWORD` đã lưu vào kho mật khẩu ngân hàng
- [ ] Lệnh `config` ở bước 4.3 hiển thị đúng giá trị

---

## Giai đoạn 5 — Build & khởi động lần đầu

```powershell
Set-Location C:\7800quiz
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Lần đầu build mất 5–15 phút (tải image nền + cài thư viện + build mã nguồn). Lưu ý: bước build ảnh `web` có chạy bộ test tự động — nếu test lỗi, việc build sẽ dừng lại (đây là chủ ý, không phải sự cố).

Kiểm tra kết quả — cả 4 dòng phải hiện `Up` và `(healthy)`:
```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

```
NAME                STATUS
quiz7800_db         Up ... (healthy)
quiz7800_api        Up ... (healthy)
quiz7800_web        Up ... (healthy)
quiz7800_proxy      Up ... (healthy)
```

Nếu có container không lên `healthy` sau ~1 phút, xem Phụ lục B.

### ✅ Checklist Giai đoạn 5
- [ ] Lệnh `up -d --build` chạy xong không báo lỗi
- [ ] Cả 4 container đều `Up (healthy)`

---

## Giai đoạn 6 — Khởi tạo cơ sở dữ liệu

```powershell
# Tạo toàn bộ bảng/cấu trúc dữ liệu (18 migration)
docker exec quiz7800_api npx prisma migrate deploy
```
Kỳ vọng dòng cuối: `All migrations have been successfully applied.`

```powershell
# Tạo dữ liệu nền: 9 chi nhánh + phòng ban, cấp độ/huy hiệu, 2 tài khoản mẫu
docker exec quiz7800_api npm run seed
```
Kỳ vọng:
```
✅ Seed hoàn thành:
  👤 admin / Admin@1234 (role: ADMIN)
  👤 nhanvien01 / Staff@1234 (role: STAFF)
  🏆 10 LevelDefinition seeded
  🏅 15 BadgeDefinition seeded
```

> Lệnh `seed` an toàn khi chạy lại nhiều lần — không reset mật khẩu admin nếu đã đổi.

### ✅ Checklist Giai đoạn 6
- [ ] `migrate deploy` báo thành công, không có lỗi P3005
- [ ] `npm run seed` chạy xong, thấy đủ dòng như trên

---

## Giai đoạn 7 — Kiểm thử nội bộ (trước khi có DNS)

Trước khi đụng tới DNS, xác nhận toàn bộ chuỗi đã chạy đúng bằng cổng kiểm thử nội bộ (chỉ máy chủ tự gọi được, không lộ ra ngoài):

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/health
# Kỳ vọng: {"status":"ok","timestamp":"..."}

(Invoke-WebRequest http://127.0.0.1:8080/ -UseBasicParsing).StatusCode
# Kỳ vọng: 200
```

Nếu cả hai đều đúng, toàn bộ hệ thống (Caddy → Web → API → Database) đã thông suốt và chỉ còn thiếu domain thật + chứng chỉ.

### ✅ Checklist Giai đoạn 7
- [ ] `/api/health` trả về `status: ok`
- [ ] Trang chủ trả về `200`

---

## Giai đoạn 8 — Trỏ DNS & kích hoạt HTTPS

### 8.1. Tạo bản ghi DNS

Nhờ bên quản trị `vbalaichau.com` tạo **bản ghi A**: `quiz` → IP public của máy chủ (nên xin IP tĩnh).

```powershell
Resolve-DnsName quiz.vbalaichau.com -Type A -Server 8.8.8.8
```
Lặp lại lệnh này cho tới khi kết quả trả về đúng IP máy chủ (có thể mất vài phút tới vài giờ để DNS lan truyền).

### 8.2. Theo dõi Caddy tự xin chứng chỉ

```powershell
docker logs -f quiz7800_proxy
```
Chờ tới khi thấy dòng `certificate obtained successfully`. Caddy tự làm mọi việc — không cần chạy lệnh nào khác. Nếu DNS đã đúng mà mãi chưa thấy, ép thử lại ngay:
```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod restart caddy
```

### 8.3. Nghiệm thu HTTPS

```powershell
Invoke-RestMethod https://quiz.vbalaichau.com/api/health

$r = Invoke-WebRequest http://quiz.vbalaichau.com/ -MaximumRedirection 0 -SkipHttpErrorCheck -UseBasicParsing
$r.StatusCode   # kỳ vọng 301 hoặc 308 — xác nhận tự chuyển hướng sang HTTPS
```

> **Nếu phải dựng đi dựng lại nhiều lần để thử nghiệm**: mở dòng `acme_ca .../staging/directory` trong file `Caddyfile` trước khi thử, vì Let's Encrypt thật giới hạn 5 chứng chỉ trùng/7 ngày — vượt hạn mức là phải chờ hết 7 ngày mới xin lại được. Nhớ đóng dòng đó lại (thêm `#` phía trước) và `docker compose restart caddy` khi chuyển sang chạy thật.

> **Nếu ngân hàng không cho mở port 80 ra Internet**: Let's Encrypt không xác thực được domain. Báo lại để đổi sang chứng chỉ do CA nội bộ ngân hàng cấp (sửa `Caddyfile`, dùng `tls <file cert> <file key>` thay vì để Caddy tự xin).

### ✅ Checklist Giai đoạn 8
- [ ] `Resolve-DnsName` trả đúng IP máy chủ
- [ ] Log Caddy có dòng `certificate obtained successfully`
- [ ] `https://quiz.vbalaichau.com/api/health` trả về đúng kết quả
- [ ] HTTP tự chuyển hướng sang HTTPS

---

## Giai đoạn 9 — Đổi mật khẩu mặc định & dọn tài khoản mẫu

1. Mở `https://quiz.vbalaichau.com`, đăng nhập `admin` / `Admin@1234`.
2. Hệ thống bắt buộc đổi mật khẩu ngay lần đăng nhập đầu — đặt mật khẩu mạnh, lưu vào kho mật khẩu ngân hàng.
3. **Chưa vội xoá** tài khoản `nhanvien01` / `Staff@1234` — để dành cho việc kiểm thử ở Giai đoạn 10, sau đó **vô hiệu hoá** nó qua trang quản trị người dùng (tài khoản demo có mật khẩu công khai trong mã nguồn).

### ✅ Checklist Giai đoạn 9
- [ ] Đã đổi mật khẩu `admin`, lưu vào kho mật khẩu
- [ ] Đã ghi nhớ sẽ vô hiệu hoá `nhanvien01` sau Giai đoạn 10

---

## Giai đoạn 10 — Kiểm thử toàn diện trước khi bàn giao

Làm tuần tự trên **thiết bị thật** — một điện thoại và một máy tính, không chỉ trên máy chủ.

### Hạ tầng
- [ ] `docker compose -f docker-compose.prod.yml --env-file .env.prod ps` → cả 4 container `(healthy)`
- [ ] Trình duyệt hiện ổ khoá xanh, chứng chỉ do "Let's Encrypt" cấp
- [ ] Từ một máy khác trong mạng: `Test-NetConnection <ip-máy-chủ> -Port 13010` → **thất bại** (API không lộ trực tiếp ra ngoài, chỉ qua Caddy)

### Xác thực
- [ ] Đăng nhập `admin` bằng mật khẩu mới → vào được
- [ ] Đăng nhập `nhanvien01` → bị ép đổi mật khẩu ngay từ đầu
- [ ] Gõ sai mật khẩu → báo lỗi tiếng Việt rõ ràng

### Import Excel — kiểm tra giới hạn dung lượng file
| Kích thước file thử | Kỳ vọng |
|---|---|
| ~2 MB | Import thành công |
| ~12 MB | Báo lỗi "file quá lớn" từ hệ thống (không phải lỗi trắng trang) |
| ~30 MB | Báo lỗi 413 rõ ràng, **không phải** trang "đang bảo trì" |

- [ ] Import ngân hàng câu hỏi, thử tính năng sửa câu ngay trên bảng xem trước
- [ ] Import danh sách cán bộ
- [ ] Xuất bảng điểm ra Excel → **kiểm tra cột thời gian hiển thị đúng giờ Việt Nam** (nếu lệch 7 tiếng, báo lại ngay)

### Làm bài kiểm tra
- [ ] Làm bài, lưu giữa chừng, bấm F5 tải lại trang → giữ nguyên câu trả lời và thời gian còn lại
- [ ] Thử một bộ đề có bật "Phản hồi tức thì" → chọn đáp án hiện đúng/sai ngay và tự chuyển câu
- [ ] Nộp bài → hiện điểm, cộng điểm thưởng đúng

### Đấu trường (tính năng dễ vỡ nhất — kiểm tra kỹ)
- [ ] Mở phòng trên máy tính, quét mã QR bằng **điện thoại dùng mạng 4G** (không dùng Wi-Fi nội bộ) → vào được phòng
- [ ] Nhiều người chơi cùng lúc, bấm chuông trả lời → cập nhật real-time trên mọi màn hình
- [ ] Mở phòng, để yên 5 phút không thao tác gì, sau đó thao tác tiếp → vẫn hoạt động bình thường
- [ ] Thử lại tương tự nhưng trong mạng nội bộ ngân hàng — nếu 4G chạy tốt mà mạng nội bộ không được thì cần báo bộ phận mạng kiểm tra thiết bị an ninh có chặn WebSocket không

### Sau khi mọi thứ ở trên đều đạt
- [ ] Vô hiệu hoá tài khoản `nhanvien01` qua trang quản trị

---

## Giai đoạn 11 — Thiết lập sao lưu tự động

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-backup-task.ps1
```

Lệnh này đăng ký một tác vụ chạy **hằng ngày lúc 02:00**, tự sao lưu toàn bộ cơ sở dữ liệu vào `C:\7800quiz-backup`, tự xoá bản cũ quá 14 ngày (giữ riêng bản đầu mỗi tháng trong 12 tháng), và tự kiểm tra file sao lưu có đọc được hay không sau mỗi lần chạy.

Script tự chạy thử ngay sau khi đăng ký — kiểm tra kết quả:
```powershell
Get-Content C:\7800quiz-backup\backup.log -Tail 10
```

> ⚠️ **Bản sao lưu nằm cùng máy chủ chưa phải là bản sao lưu thật sự.** Mở file `scripts\backup-db.ps1`, tìm phần "Sao chép ra kho ngoài" ở cuối file, bỏ dấu `#` và điền đường dẫn ổ mạng lưu trữ của ngân hàng.

> ⚠️ Nếu tài khoản `SYSTEM` không gọi được lệnh Docker (lỗi trong `backup.log`), kiểm tra `net localgroup docker-users` — cần thêm SYSTEM (hoặc đổi sang chạy bằng tài khoản dịch vụ thuộc nhóm đó).

### ✅ Checklist Giai đoạn 11
- [ ] Tác vụ Task Scheduler đã đăng ký thành công
- [ ] `backup.log` xác nhận chạy thành công lần đầu
- [ ] Đã cấu hình sao chép ra kho lưu trữ ngoài máy chủ
- [ ] Đã đặt lịch nhắc diễn tập phục hồi thử mỗi quý (xem Phụ lục A)

---

## Giai đoạn 12 — Go-live

Chỉ chuyển sang dùng thật khi **toàn bộ checklist Giai đoạn 1–11 đã đánh dấu xong**.

- [ ] Thông báo địa chỉ `https://quiz.vbalaichau.com` cho các chi nhánh
- [ ] Bàn giao mật khẩu `admin` mới cho người phụ trách vận hành lâu dài (không phải người triển khai)
- [ ] Ghi lại vào sổ tay vận hành: vị trí file `.env.prod` (chứa bí mật), vị trí bản sao lưu, lịch backup, cách xem log (Phụ lục C)
- [ ] Đặt lịch kiểm tra định kỳ (gợi ý: hằng tuần) chạy nhanh checklist "Hạ tầng" ở Giai đoạn 10

**Chúc mừng — hệ thống đã sẵn sàng phục vụ.** Các phụ lục dưới đây dùng cho vận hành về sau, không cần đọc ngay.

---

## Phụ lục A — Vận hành: cập nhật phiên bản & rollback

### Cập nhật lên bản mới

```powershell
Set-Location C:\7800quiz

# 1. BẮT BUỘC sao lưu trước — Prisma không có "migration đảo chiều"
powershell -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1

# 2. Gắn nhãn image hiện tại để còn đường lùi
docker image tag quiz7800/api:latest quiz7800/api:prev
docker image tag quiz7800/web:latest quiz7800/web:prev

# 3. Lấy mã nguồn mới, build (chưa đụng gì tới hệ thống đang chạy)
git pull --ff-only
docker compose -f docker-compose.prod.yml --env-file .env.prod build

# 4. Cửa sổ bảo trì ngắn — Caddy vẫn chạy nên người dùng thấy trang
#    "Đang bảo trì" thân thiện thay vì lỗi trình duyệt trần trụi
docker compose -f docker-compose.prod.yml --env-file .env.prod stop api web

# 5. Chạy migration bằng bản mã nguồn MỚI
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm api npx prisma migrate deploy

# 6. Bật lại và nghiệm thu
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
Invoke-RestMethod https://quiz.vbalaichau.com/api/health
```

> ⚠️ Bắt buộc có `--build` — `docker compose restart` sẽ không lấy mã nguồn mới vì image được build sẵn từ trước.
> ⚠️ **Tuyệt đối không cập nhật khi đang có kỳ thi diễn ra.**

### Rollback

**Chỉ đổi mã nguồn, không đổi cấu trúc dữ liệu** (trường hợp thường gặp):
```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod stop api web
docker image tag quiz7800/api:prev quiz7800/api:latest
docker image tag quiz7800/web:prev quiz7800/web:latest
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --no-build
```

**Bản mới có thay đổi cấu trúc dữ liệu** (bắt buộc phục hồi từ bản sao lưu):
```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod stop api web
powershell -ExecutionPolicy Bypass -File .\scripts\restore-db.ps1 -DumpFile <đường-dẫn-bản-dump-trước-khi-update>
git checkout <commit-tốt-trước-đó>
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

### Diễn tập phục hồi (khuyến nghị mỗi quý)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\restore-db.ps1 -DumpFile <một-bản-dump-bất-kỳ>
```
Bản sao lưu chưa từng được phục hồi thử thì chưa phải là bản sao lưu đáng tin.

---

## Phụ lục B — Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `prisma migrate deploy` báo lỗi **P3005** | Dùng nhầm `docker-compose.yml` của môi trường dev | Chỉ dùng `docker-compose.prod.yml` cho production, không trộn lẫn |
| Container `api` khởi động rồi tắt liên tục, log báo thiếu `JWT_SECRET` | Chưa điền hoặc điền sai `.env.prod` | Xem lại Giai đoạn 4.2 — đây là hành vi cố ý: thà dừng ngay còn hơn chạy với khoá mặc định không an toàn |
| Đấu trường không kết nối được, mọi thứ khác vẫn bình thường | Thiết bị bảo mật mạng nội bộ chặn nâng cấp WebSocket | Mở DevTools trên trình duyệt (F12) → tab Network → lọc "WS" → phải thấy trạng thái **101**. Nếu 4G chạy được mà mạng công ty không được, cần báo bộ phận mạng |
| Import file báo lỗi **413** | File vượt quá 25MB | Chia nhỏ file trước khi import |
| Import file hiện trang "đang bảo trì" | API thực sự đang gặp sự cố (không phải do file lớn) | `docker logs quiz7800_api` để xem chi tiết |
| Docker báo lỗi liên quan `bind`/`socket`/`access permissions` khi khởi động | Windows đã giữ chỗ trước cổng 443 | `net stop winnat` → chạy lại lệnh `up -d` → `net start winnat` |
| Máy chủ khởi động lại xong nhưng container không tự chạy | Đang dùng Docker Desktop, cần phiên đăng nhập | Xem Giai đoạn 2 Phương án A (máy ảo Ubuntu tự khởi động không cần đăng nhập) |
| Cột thời gian trong file Excel xuất ra bị lệch 7 tiếng | Biến `TZ` chưa được nạp đúng | Kiểm tra `.env.prod` có `TZ=Asia/Ho_Chi_Minh`, chạy `docker compose ... up -d api` |
| Caddy mãi không xin được chứng chỉ | DNS chưa trỏ đúng, port 80 chưa mở, hoặc đã thử quá nhiều lần trong 7 ngày (vượt hạn mức Let's Encrypt) | `docker logs quiz7800_proxy`; nếu vượt hạn mức phải chờ hoặc dùng chế độ `staging` để thử nghiệm (xem Giai đoạn 8.3) |

### Lệnh chẩn đoán nhanh

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail 100 api
docker logs --tail 50 quiz7800_proxy
Invoke-RestMethod http://127.0.0.1:8080/api/health   # kiểm tra bỏ qua DNS/HTTPS, chỉ test nội bộ
```

---

## Phụ lục C — Tham chiếu nhanh

### Container & port

| Container | Vai trò | Port ra ngoài |
|---|---|---|
| `quiz7800_proxy` | Caddy — cổng vào duy nhất | 80, 443 (và `127.0.0.1:8080` chỉ để test nội bộ) |
| `quiz7800_web` | Giao diện web | Không mở ra ngoài |
| `quiz7800_api` | NestJS + Socket.IO | Không mở ra ngoài |
| `quiz7800_db` | PostgreSQL | Không mở ra ngoài |

### File quan trọng

| File | Vai trò |
|---|---|
| `docker-compose.prod.yml` | Cấu hình toàn bộ hệ thống production |
| `Caddyfile` | Cấu hình reverse proxy + HTTPS |
| `.env.prod` | **Bí mật** — mật khẩu DB, khoá JWT (không commit, không chia sẻ qua kênh không an toàn) |
| `scripts/backup-db.ps1` | Sao lưu thủ công/tự động |
| `scripts/restore-db.ps1` | Phục hồi từ bản sao lưu |
| `scripts/register-backup-task.ps1` | Đăng ký lịch sao lưu tự động |
| `C:\7800quiz-backup\` | Nơi lưu các bản sao lưu |

### Tài khoản

| Username | Mật khẩu ban đầu | Vai trò | Ghi chú |
|---|---|---|---|
| `admin` | `Admin@1234` | ADMIN | Bắt buộc đổi ngay lần đăng nhập đầu (Giai đoạn 9) |
| `nhanvien01` | `Staff@1234` | STAFF | Chỉ dùng để kiểm thử — vô hiệu hoá sau Giai đoạn 10 |

### Lệnh dùng hằng ngày

```powershell
# Xem trạng thái
docker compose -f docker-compose.prod.yml --env-file .env.prod ps

# Xem log
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f api

# Sao lưu ngay lập tức (ngoài lịch tự động)
powershell -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1
```
