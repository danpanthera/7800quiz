# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc trong repo này.

## Tổng quan

**7800Quiz** — hệ thống quiz/kiểm tra nội bộ cho một ngân hàng, kiến trúc **web responsive online-first**: một portal duy nhất chạy trên trình duyệt (phone/tablet/PC), server NestJS là trung tâm chấm điểm/quản trị chính thức. Không còn app native cho điện thoại — chỉ phân phối nội bộ, không lên store công khai.

Tài liệu kiến trúc & trạng thái triển khai đầy đủ: [.github/agents/7800quiz.agent.md](.github/agents/7800quiz.agent.md).
Hướng dẫn phát hành nội bộ (domain quiz.vbalaichau.com + Nginx prod): [DEPLOYMENT.md](DEPLOYMENT.md).

## Monorepo

```
apps/api      NestJS 11 + Prisma 6.19.3 + Socket.IO — REST API + WebSocket Gateway (Arena)
apps/web      React 19 + Vite 8 + Ant Design 6 — portal responsive theo vai trò STAFF/TRAINER/ADMIN
db/           SQL init cho container Postgres (docker-entrypoint-initdb.d)
```

## Lệnh thường dùng

**Khởi động toàn bộ môi trường dev (khuyến nghị)**:
```bash
./dev.sh   # tự start Docker Postgres/API/Web
```

**API** (`apps/api/`):
```bash
npm run start:dev              # watch mode, cổng 13010
npx prisma migrate dev --name <ten_migration>   # tạo migration mới sau khi sửa schema.prisma
npx prisma generate            # regen Prisma client sau khi đổi schema
npm run seed                   # chạy prisma/seed.ts
npm run lint
npm test                       # jest unit test
```

**Web** (`apps/web/`):
```bash
npm run dev      # Vite dev server, cổng 15173
npm run build    # tsc -b && vite build
npm run lint
```

**Database dev**: Postgres 16 qua Docker/OrbStack tại `localhost:15433`, DB `quiz7800`. Xem phần "OrbStack — Quy trình chuẩn & Xử lý sự cố" trong `7800quiz.agent.md` nếu Docker không start được.

## Quy ước code trong repo

- **Tên kỹ thuật bằng tiếng Anh**: tên file, class, biến, endpoint theo chuẩn NestJS/Prisma/React hiện có trong repo (`admin.controller.ts`, `ArenaSession`, `AttemptsService`...). Không đổi ngược sang tiếng Việt cho code đã tồn tại — giữ nhất quán với phần còn lại của codebase.
- **Comment, chuỗi UI, thông báo lỗi, tài liệu**: luôn bằng tiếng Việt có dấu đầy đủ — đúng convention đã dùng xuyên suốt repo (xem các `.service.ts`, các trang web, seed data).
- **Prisma schema**: tên model PascalCase tiếng Anh, map sang bảng snake_case qua `@@map`/`@map`. Enum cũng map tương tự. Giữ đúng pattern này khi thêm model mới.
- **Idempotency bắt buộc**: mọi endpoint nhận bài nộp phải dùng UUID client-gen làm khóa, trả 409 khi trùng thay vì lỗi — không được đổi sang auto-increment ID.
- **Thời gian**: luôn `timestamptz`/UTC ở server, không tin đồng hồ client cho điểm số chính thức.
- **Không commit** `.env`/`.env.*`, khoá/chứng chỉ (`*.pem`, `*.key`, `*.jks`, `*.keystore`) — đã chặn qua `.gitignore`, kiểm tra kỹ trước khi `git add`.
- **Base URL API**: web luôn gọi qua đường dẫn tương đối `/api` (`apps/web/src/lib/api.ts`, axios `baseURL: '/api'`) — dựa vào same-origin proxy (Vite dev proxy hoặc Nginx prod), không hardcode host/port. WebSocket đọc từ `VITE_WS_URL` (mặc định `window.location.origin`).

## Lưu ý quan trọng khi sửa code

- **Quiz version**: sửa nội dung quiz đã có bài làm phải tạo `QuizVersion` mới, không sửa trực tiếp version cũ (tránh lệch đề với bài đã nộp).
- **Luồng làm bài**: `attempts.module.ts` quản lý trạng thái đang làm (start/save/finalize), tạo `Submission` khi nộp — không quay lại mô hình ghi local rồi đồng bộ sau (offline-first) vì đã bỏ app mobile, giờ là online-first thuần.
- **Arena WebSocket**: `arena.gateway.ts` xử lý real-time buzz-in — không đưa logic tính điểm/reveal đáp án vào REST controller, giữ trong `arena.service.ts` để cả REST và Gateway dùng chung. Phía "người chơi" (join bằng joinCode, buzz-in) đã có giao diện web tại `ArenaPlayerPage.tsx` (route `/arena/join/:joinCode`) — route này đứng **ngoài** `AppLayout`, chạy full-screen độc lập (vẫn yêu cầu đăng nhập qua `RequireAuth`) vì học viên thường quét QR vào chơi bằng điện thoại, không cần Header/Sider của portal quản trị.
- **Gamification**: mọi thao tác cộng XP phải đi qua `gamification.service.ts` (ghi `XpTransaction` + cập nhật `UserProgress`), không cộng thẳng field `xp` từ chỗ khác để tránh mất lịch sử.

## Tài khoản seed (dev)

| Username | Password | Role |
|----------|----------|------|
| `admin` | `Admin@1234` | ADMIN |
| `nhanvien01` | `Staff@1234` | STAFF |

> Mật khẩu trên là giá trị mặc định trong `apps/api/prisma/seed.ts` (áp dụng khi seed lại từ đầu). Mật khẩu `admin` trên môi trường dev hiện tại đã được đổi thủ công thành `Abcd@1234` — dùng giá trị này khi test đăng nhập thật trên dev, trừ khi seed lại DB.
