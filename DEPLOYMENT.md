# 7800Quiz — Hướng dẫn Triển khai Nội bộ

## Mục lục
1. [Chạy trên thiết bị thật (dev)](#chay-thiet-bi-that)
2. [Cấu hình Push Notification (Firebase)](#push-notification)
3. [Phân phối iOS nội bộ (ABM/MDM)](#ios-mdm)
4. [Phân phối Android nội bộ (MDM / APK)](#android-mdm)

---

> **Trạng thái (2026-09-02)**: `apps/mobile/android/` và `apps/mobile/ios/` đã được scaffold và cấu hình (xem `.github/agents/7800quiz.agent.md`). Package ID chính thức: **`com.vbalaichau.quiz`** (theo domain `quiz.vbalaichau.com`, cùng convention với project Khoan → `khoan.vbalaichau.com`). Máy dev hiện tại vẫn **chưa cài** Android Studio/SDK và Xcode/CocoaPods — cần cài trước khi build/chạy thử theo hướng dẫn dưới.

---

## 1. Chạy trên thiết bị thật (dev) {#chay-thiet-bi-that}

### 1.1 Cài toolchain (một lần)

| Việc | Cách làm |
|---|---|
| Android Studio + SDK | Tải từ [developer.android.com/studio](https://developer.android.com/studio) (bundle sẵn JBR — máy dev hiện chưa có Java runtime nào, cài Android Studio giải quyết luôn việc này). Mở 1 lần → Setup Wizard → cài SDK Platform mới nhất + Command-line Tools |
| Xcode | Cài từ Mac App Store (~15GB, cần Apple ID). Mở 1 lần để chấp nhận license |
| Xcode CLI tools | `sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer && sudo xcodebuild -runFirstLaunch` |
| CocoaPods | `brew install cocoapods` — **không** dùng `sudo gem install cocoapods` (Ruby hệ thống trên macOS quá cũ, gây lỗi cài đặt) |
| Android licenses | `flutter config --android-sdk "$HOME/Library/Android/sdk"` rồi `yes \| flutter doctor --android-licenses` |
| Kiểm tra | `flutter doctor -v` — phải hết dấu ✗ ở Android toolchain / Xcode / CocoaPods |

### 1.2 Cấu hình URL API theo môi trường

App dùng `--dart-define-from-file` (xem `apps/mobile/lib/core/env.dart`), KHÔNG hardcode `localhost` — trên điện thoại thật, `localhost` trỏ về chính điện thoại chứ không phải máy chạy API.

| File (`apps/mobile/env/`) | API_URL | Dùng cho |
|---|---|---|
| `dev.json` | `http://localhost:13010/api` | Web-server (`./dev.sh`), iOS Simulator |
| `emulator.json` | `http://10.0.2.2:13010/api` | Android Emulator |
| `lan.json` | IP LAN máy dev (gitignored, tự sinh) | Điện thoại thật cùng Wi-Fi |
| `prod.json` | `https://quiz.vbalaichau.com/api` | Build release |

### 1.3 Chạy nhanh qua `dev.sh`

```bash
./dev.sh android   # tự dò IP LAN, ghi env/lan.json, chạy `flutter run` foreground
./dev.sh ios       # tương tự, cho iPhone/Simulator
./dev.sh device    # không phân biệt platform, để flutter run tự hỏi chọn thiết bị
```

Script in ra URL LAN (`http://<LAN_IP>:13010/api`) — **mở thử bằng trình duyệt điện thoại trước** khi chạy app, để phát hiện sớm lỗi Firewall macOS hoặc Wi-Fi bật AP/Client Isolation (2 nguyên nhân phổ biến nhất khiến điện thoại không gọi được API dù cùng mạng).

### 1.4 Chạy thủ công (không qua dev.sh)

```bash
cd apps/mobile

# Android Emulator
flutter run --dart-define-from-file=env/emulator.json

# Thiết bị thật (Android/iOS) qua LAN — sửa IP trong env/lan.json trước
flutter run --dart-define-from-file=env/lan.json

# Kiểm tra build compile được (không cần Apple ID/signing)
flutter build ios --debug --no-codesign
flutter build apk --debug
```

### 1.5 Android cleartext HTTP khi test LAN

Build debug/profile đã bật `network_security_config.xml` cho phép `http://` (xem `android/app/src/debug/`). **Build release KHÔNG có** — Android 9+ mặc định chặn cleartext, nên bản release bắt buộc trỏ về domain HTTPS thật (`env/prod.json`), không test được qua LAN HTTP thuần.

### 1.6 iOS — Local Network & ATS

`Info.plist` đã có `NSLocalNetworkUsageDescription` (iOS 14+ sẽ hỏi quyền khi app gọi IP LAN — từ chối là app không kết nối được) và `NSAppTransportSecurity → NSAllowsLocalNetworking` (cho cleartext tới LAN, không nới lỏng HTTPS công cộng). Lần đầu chạy trên máy thật, chấp nhận prompt "Tìm kiếm và kết nối với thiết bị trên mạng cục bộ".

---

## 2. Cấu hình Push Notification (Firebase) {#push-notification}

> **Hiện đang hoãn** (quyết định 2026-09-02) — Gradle Android đã cấu hình để chỉ áp dụng plugin Google Services **khi có** `google-services.json` (xem `apps/mobile/android/app/build.gradle.kts`), nên build/chạy app vẫn hoạt động bình thường khi chưa làm phần này; toàn bộ tính năng push chỉ đơn giản tắt (`notification_service.dart` tự guard `Firebase.apps.isEmpty`). Làm phần dưới khi sẵn sàng bật push.

### 2.1 Tạo Firebase Project

1. Truy cập [https://console.firebase.google.com](https://console.firebase.google.com)
2. **Thêm project** → đặt tên `7800quiz-internal`
3. Tắt Google Analytics (không cần thiết cho app nội bộ)

### 2.2 Dùng FlutterFire CLI — khuyến nghị thay vì thêm app thủ công

Thay vì làm từng bước qua Console rồi tự tay chép `google-services.json`, dùng CLI để sinh đồng bộ cả file native lẫn `lib/firebase_options.dart`:

```bash
dart pub global activate flutterfire_cli
brew install firebase-cli && firebase login

cd apps/mobile
flutterfire configure --project=7800quiz-internal \
  --platforms=android,ios,web,macos \
  --android-package-name=com.vbalaichau.quiz \
  --ios-bundle-id=com.vbalaichau.quiz
```

Lệnh này tự tạo app Android/iOS/Web/macOS trên Firebase Console, tải `google-services.json` → `apps/mobile/android/app/`, `GoogleService-Info.plist` → `apps/mobile/ios/Runner/`, và sinh `lib/firebase_options.dart`.

**Sau khi chạy xong**, sửa `apps/mobile/lib/main.dart` — đổi:
```dart
await Firebase.initializeApp();
```
thành:
```dart
await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
```
(và import `firebase_options.dart`). `lib/firebase_options.dart` **commit được** vào git (API key Firebase client bị ràng buộc bởi package name/bundle id, không phải secret); `google-services.json` và `GoogleService-Info.plist` **không commit** (đã có trong `.gitignore`).

Gradle Android **không cần sửa gì thêm** — điều kiện `if (file("google-services.json").exists())` trong `build.gradle.kts` tự nhận ra file vừa được tạo.

### 2.3 Capabilities iOS (Xcode GUI — bắt buộc thủ công)

1. Mở `apps/mobile/ios/Runner.xcworkspace` (không phải `.xcodeproj`) bằng Xcode
2. Target `Runner` → **Signing & Capabilities** → chọn Team
3. **+ Capability** → `Push Notifications` (Xcode tự tạo `Runner.entitlements`)
4. **+ Capability** → `Background Modes` → tick `Remote notifications` (Info.plist đã có sẵn key này, capability UI của Xcode cần bật riêng để entitlement khớp)

### 2.4 Cấu hình APNs (iOS) — bắt buộc để iOS nhận được push

1. Apple Developer Portal → **Certificates, IDs & Profiles** → **Keys** → tạo key với **Apple Push Notifications service (APNs)**
2. Tải file `.p8`
3. Firebase Console → Project Settings → Cloud Messaging → **Apple app configuration** → upload file `.p8`

> ⚠️ **Cần Apple Developer Program trả phí ($99/năm)** — tài khoản Apple ID miễn phí (Personal Team) **không thể** bật entitlement `aps-environment`, nên không nhận được push trên iOS dù mọi bước khác đã đúng.

### 2.5 Cấu hình Server (NestJS)

1. Firebase Console → **Project Settings** → tab **Service accounts**
2. Click **Generate new private key** → tải file JSON
3. Mở file JSON → copy toàn bộ nội dung → paste vào `apps/api/.env` (dạng 1 dòng JSON):
   ```env
   FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"7800quiz-internal","private_key_id":"abc...","private_key":"-----BEGIN RSA PRIVATE KEY-----\n...","client_email":"firebase-adminsdk-xxx@7800quiz-internal.iam.gserviceaccount.com","client_id":"...","auth_uri":"...","token_uri":"..."}
   ```
   > **Lưu ý bảo mật**: Không commit file JSON vào Git. File `.env` đã được thêm vào `.gitignore`.

### 2.6 Kiểm tra

```bash
# Restart API server
cd apps/api && npm run start:dev

# Log xác nhận thành công:
# [NotificationsService] Firebase Admin initialized
```

Khi admin mở đợt thi (DRAFT → OPEN), tất cả học viên trong lớp có FCM token sẽ nhận được thông báo:
- **Tiêu đề**: 📝 Đợt thi mới đã mở
- **Nội dung**: "Tên bộ đề" — Tên đợt thi đang chờ bạn!

---

## 3. Phân phối iOS nội bộ (ABM/MDM) {#ios-mdm}

### Phương án A: Apple Business Manager (ABM) + MDM — **Khuyến nghị**

**Yêu cầu**: Apple Business Manager account (liên hệ `business.apple.com`)

```
Luồng triển khai:
ABM → Custom App → MDM (Jamf / Mosyle / Kandji) → thiết bị nhân viên
```

**Các bước**:

1. **Đăng ký ABM**: Truy cập [business.apple.com](https://business.apple.com) → đăng ký tổ chức
2. **Tích hợp MDM**: ABM Settings → MDM Servers → thêm MDM server của ngân hàng
3. **Build app**:
   ```bash
   cd apps/mobile
   flutter build ipa --release --dart-define-from-file=env/prod.json
   # File: build/ios/ipa/mobile_7800quiz.ipa
   ```
4. **Upload lên App Store Connect** (dạng Custom App — không public):
   - App Store Connect → **My Apps** → **+** → New App
   - Chọn **Custom Apps** → distribute cho ABM organization
5. **Phân phối qua MDM**: MDM console → Apps → thêm Custom App từ ABM → assign cho nhóm nhân viên

### Phương án B: Enterprise Distribution (cho tổ chức >100 nhân viên)

**Yêu cầu**: Apple Developer Enterprise Program ($299/năm)

```bash
# Build với distribution certificate dạng Enterprise
flutter build ipa --release --dart-define-from-file=env/prod.json \
  --export-options-plist=ios/ExportOptions_Enterprise.plist
```

```xml
<!-- ios/ExportOptions_Enterprise.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ...>
<plist version="1.0">
<dict>
  <key>method</key>
  <string>enterprise</string>
  <key>teamID</key>
  <string>YOUR_TEAM_ID</string>
</dict>
</plist>
```

Host file `.ipa` + manifest `.plist` trên web server nội bộ HTTPS, phân phối qua link `itms-services://`.

---

## 4. Phân phối Android nội bộ (MDM / APK) {#android-mdm}

### Phương án A: Managed Google Play (khuyến nghị dài hạn)

1. **Google Workspace** → Admin Console → **Devices** → **Apps** → **Managed Google Play**
2. Upload APK dạng **Private App**
3. Phân phối cho managed devices qua MDM policy

```bash
# Build APK release
cd apps/mobile
flutter build apk --release --split-per-abi --dart-define-from-file=env/prod.json
# Files: build/app/outputs/flutter-apk/app-arm64-v8a-release.apk
```

### Phương án B: MDM Direct Push (ngắn hạn)

Dùng MDM như **Microsoft Intune**, **VMware Workspace ONE**, hoặc **SOTI MobiControl**:

1. Upload APK vào MDM console
2. Assign cho nhóm thiết bị Android của ngân hàng
3. MDM tự cài silent (không cần user tay)

### Phương án C: APK link trực tiếp (test nhanh, không khuyến nghị production)

```bash
# Host trên web server nội bộ
cp build/app/outputs/flutter-apk/app-release.apk /var/www/internal/7800quiz.apk

# Nhân viên cài: bật "Unknown sources" → mở link http://intranet/7800quiz.apk
```

> ⚠️ **Chỉ dùng cho test**. Không an toàn cho production vì không có cơ chế update tự động.

---

## Cấu hình Build (Android) — đã áp dụng sẵn trong repo

`apps/mobile/android/app/build.gradle.kts` (Kotlin DSL, không phải Groovy `.gradle`):

```kotlin
android {
    namespace = "com.vbalaichau.quiz"
    defaultConfig {
        applicationId = "com.vbalaichau.quiz"   // package name chính thức
        minSdk = flutter.minSdkVersion           // = 24 (mặc định Flutter 3.41,
        targetSdk = flutter.targetSdkVersion     //   local_auth yêu cầu tối thiểu 24)
        // compileSdk = 36, AGP 8.11.1, Kotlin 2.2.20, Java 17 — mặc định Flutter, không hạ xuống
        multiDexEnabled = true
    }
    compileOptions {
        isCoreLibraryDesugaringEnabled = true    // bắt buộc cho flutter_local_notifications
    }
}
dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}
```

Ký release đọc từ `android/key.properties` (xem `key.properties.example` trong cùng thư mục) — fallback về debug-signing khi chưa có file, để `flutter build apk --release` vẫn build được trong lúc dev.

### Tạo keystore (1 lần duy nhất, lưu ngoài repo):
```bash
keytool -genkeypair -v \
  -keystore ~/keys/7800quiz.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias 7800quiz
```

Rồi copy `apps/mobile/android/key.properties.example` thành `key.properties` (cùng thư mục, đã gitignore) và điền `storeFile`/`storePassword`/`keyAlias`/`keyPassword`.

> ⚠️ **Bảo mật**: Lưu keystore ở nơi an toàn NGOÀI repo, KHÔNG commit `key.properties` hay file `.jks`/`.keystore` vào Git.

---

## Cấu hình Build (iOS) — đã áp dụng sẵn trong repo

- `Podfile`: `platform :ios, '13.0'` (yêu cầu cao nhất trong các plugin đang dùng), `post_install` ép `IPHONEOS_DEPLOYMENT_TARGET = '13.0'` cho mọi pod.
- Chạy `pod install` trong `apps/mobile/ios/` sau khi cài CocoaPods (tự động chạy khi `flutter build ios`/`flutter run` lần đầu).
- `Info.plist`: `NSFaceIDUsageDescription`, `NSLocalNetworkUsageDescription`, `NSAppTransportSecurity` (chỉ cho LAN nội bộ), `UIBackgroundModes: remote-notification`.
- Bundle ID `com.vbalaichau.quiz` đã set ở cả 3 build configuration (Debug/Profile/Release) của target Runner.
- Signing + capabilities Push Notifications/Background Modes: làm qua Xcode GUI (mục 2.3).

---

## Checklist triển khai Production

- [ ] Đổi `JWT_SECRET` thành chuỗi ngẫu nhiên 64 ký tự
- [ ] Cấu hình PostgreSQL production (Windows Server native hoặc Docker)
- [ ] Cấu hình HTTPS cho API (nginx reverse proxy + SSL cert) — **bao gồm location `/socket.io/` với header Upgrade** cho Arena, xem `.github/agents/7800quiz.agent.md`
- [ ] `apps/mobile/env/prod.json` trỏ đúng domain HTTPS thật (`https://quiz.vbalaichau.com/api`)
- [ ] (Tuỳ chọn — push) Cấu hình Firebase project qua `flutterfire configure`, set `FIREBASE_SERVICE_ACCOUNT_JSON` trên server
- [ ] Build APK/IPA release với signing certificate thật (không phải debug-signing fallback)
- [ ] Đăng ký ABM hoặc Managed Google Play
- [ ] Setup MDM và assign app cho nhóm thiết bị nhân viên
- [ ] Test end-to-end trên thiết bị thật: login → đổi mật khẩu → biometric → làm bài offline (máy bay) → sync khi có mạng lại → Arena real-time → (nếu đã bật) push notification
