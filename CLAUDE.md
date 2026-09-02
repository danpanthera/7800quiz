# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc trong repo này.

## Tổng quan

**7800Quiz** — hệ thống quiz/kiểm tra nội bộ cho một ngân hàng, kiến trúc **offline-first**: app mobile cho làm bài offline, server NestJS là trung tâm chấm điểm/quản trị chính thức. Không phát hành lên store công khai — chỉ phân phối nội bộ qua MDM/ABM.

Tài liệu kiến trúc & trạng thái triển khai đầy đủ: [.github/agents/7800quiz.agent.md](.github/agents/7800quiz.agent.md).
Hướng dẫn phát hành nội bộ (Firebase push, MDM iOS/Android, domain quiz.vbalaichau.com + Nginx prod): [DEPLOYMENT.md](DEPLOYMENT.md).

## Monorepo

```
apps/api      NestJS 11 + Prisma 6.19.3 + Socket.IO — REST API + WebSocket Gateway (Arena)
apps/admin    React 19 + Vite 8 + Ant Design 6 — cổng quản trị
apps/mobile   Flutter 3.41.9 — app offline-first, platform Android + iOS đã scaffold
              (package com.vbalaichau.quiz) — máy dev hiện chưa cài Android SDK/Xcode để build thật
db/           SQL init cho container Postgres (docker-entrypoint-initdb.d)
```

## Lệnh thường dùng

**Khởi động toàn bộ môi trường dev (khuyến nghị)**:
```bash
./dev.sh   # tự start Docker Postgres + tmux session "7800quiz" (windows: api, admin, mobile)
tmux attach -t 7800quiz
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

**Admin** (`apps/admin/`):
```bash
npm run dev      # Vite dev server, cổng 15173
npm run build    # tsc -b && vite build
npm run lint
```

**Mobile** (`apps/mobile/`):
```bash
flutter run -d chrome                                       # dev nhanh — không cần toolchain native
flutter run --dart-define-from-file=env/emulator.json       # Android Emulator
flutter run --dart-define-from-file=env/lan.json            # thiết bị thật qua LAN (hoặc: ../../dev.sh android)
dart run build_runner build --delete-conflicting-outputs    # BẮT BUỘC sau khi sửa local_db.dart (Drift)
flutter test                                                 # chạy trên Dart VM, không cần Android SDK/Xcode
```
Không hardcode `API_URL` — luôn qua `--dart-define-from-file=env/<mode>.json` (xem `lib/core/env.dart`). `./dev.sh android|ios|device` ở gốc repo tự dò IP LAN và ghi `env/lan.json`.

**Database dev**: Postgres 16 qua Docker/OrbStack tại `localhost:15433`, DB `quiz7800`. Xem phần "OrbStack — Quy trình chuẩn & Xử lý sự cố" trong `7800quiz.agent.md` nếu Docker không start được.

## Quy ước code trong repo

- **Tên kỹ thuật bằng tiếng Anh**: tên file, class, biến, endpoint theo chuẩn NestJS/Prisma/Flutter/React hiện có trong repo (`admin.controller.ts`, `ArenaSession`, `SyncManager`...). Không đổi ngược sang tiếng Việt cho code đã tồn tại — giữ nhất quán với phần còn lại của codebase.
- **Comment, chuỗi UI, thông báo lỗi, tài liệu**: luôn bằng tiếng Việt có dấu đầy đủ — đúng convention đã dùng xuyên suốt repo (xem các `.service.ts`, các trang admin, seed data).
- **Prisma schema**: tên model PascalCase tiếng Anh, map sang bảng snake_case qua `@@map`/`@map`. Enum cũng map tương tự. Giữ đúng pattern này khi thêm model mới.
- **Idempotency bắt buộc**: mọi endpoint nhận submission/sync từ app phải dùng UUID client-gen làm khóa, trả 409 khi trùng thay vì lỗi — không được đổi sang auto-increment ID.
- **Thời gian**: luôn `timestamptz`/UTC ở server, không tin device clock của client cho điểm số chính thức.
- **Không commit** `.env`, `google-services.json`, `GoogleService-Info.plist`, `android/key.properties`, `*.jks`/`*.keystore`, `apps/mobile/env/lan.json` (IP riêng từng máy dev) — đã có trong `.gitignore`, kiểm tra kỹ trước khi `git add`.

## Lưu ý quan trọng khi sửa code

- **Offline-first**: mọi thay đổi ở `quiz_player`/`submissions` phải giữ nguyên tắc ghi local trước, sync sau (Drift outbox queue → `SyncManager` → `POST /submissions`). Không refactor sang gọi API trực tiếp chặn UI.
- **Quiz version**: sửa nội dung quiz đã có bài làm phải tạo `QuizVersion` mới, không sửa trực tiếp version cũ (tránh lệch đề với bài đã nộp).
- **Arena WebSocket**: `arena.gateway.ts` xử lý real-time buzz-in — không đưa logic tính điểm/reveal đáp án vào REST controller, giữ trong `arena.service.ts` để cả REST và Gateway dùng chung.
- **Gamification**: mọi thao tác cộng XP phải đi qua `gamification.service.ts` (ghi `XpTransaction` + cập nhật `UserProgress`), không cộng thẳng field `xp` từ chỗ khác để tránh mất lịch sử.
- **Mobile Web build**: `local_db.dart` dùng conditional import (`db_connection_native.dart` / `db_connection_web.dart`) vì `sqlite3` FFI không compile trên Chrome — không gộp lại thành 1 file dùng FFI trực tiếp.
- **Cấu hình URL mobile**: mọi nơi cần base URL API/WebSocket phải đọc qua `lib/core/env.dart` (`Env.apiUrl`/`Env.wsUrl`), không tự thêm `String.fromEnvironment('API_URL', ...)` hay hardcode `localhost` ở file khác — trên phone thật `localhost` trỏ về chính điện thoại. WS URL suy ra bằng `Uri.replace(path:'')`, không dùng `replaceAll('/api','')`.
- **`MainActivity.kt` phải là `FlutterFragmentActivity`** (không phải `FlutterActivity`) — `local_auth` dùng `BiometricPrompt`, cần `FragmentActivity` hay crash khi bấm vân tay/Face ID.
- **Firebase đang hoãn**: `lib/main.dart` gọi `Firebase.initializeApp()` không kèm `options:` vì chưa chạy `flutterfire configure`. Khi bật push, xem `DEPLOYMENT.md` mục 2 — nhớ đổi cả `main.dart` sang dùng `DefaultFirebaseOptions.currentPlatform`.
- **Android Gradle áp dụng Google Services có điều kiện** (`if (file("google-services.json").exists())` trong `android/app/build.gradle.kts`) — không xoá điều kiện này, nếu không build sẽ fail trên máy chưa cấu hình Firebase.

## Tài khoản seed (dev)

| Username | Password | Role |
|----------|----------|------|
| `admin` | `Admin@1234` | ADMIN |
| `nhanvien01` | `Staff@1234` | STAFF |
