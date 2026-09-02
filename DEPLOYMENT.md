# 7800Quiz — Hướng dẫn Triển khai Nội bộ

## Mục lục
1. [Cấu hình Push Notification (Firebase)](#push-notification)
2. [Phân phối iOS nội bộ (ABM/MDM)](#ios-mdm)
3. [Phân phối Android nội bộ (MDM / APK)](#android-mdm)

---

> ⚠️ **Lưu ý hiện trạng (2026-09-02)**: repo `apps/mobile/` hiện **chưa có** thư mục `android/` và `ios/` — project Flutter mới scaffold Web + macOS. Trước khi làm theo bất kỳ bước build APK/IPA nào ở dưới, chạy trước:
> ```bash
> cd apps/mobile
> flutter create --platforms=android,ios .
> ```
> để sinh lại 2 thư mục native, sau đó mới áp `applicationId`/Bundle ID và các file cấu hình Firebase bên dưới. Máy dev hiện tại cũng chưa cài đủ Android SDK và Xcode (`flutter doctor` báo thiếu) — cần cài đặt trước khi build thử.

---

## 1. Cấu hình Push Notification (Firebase) {#push-notification}

### 1.1 Tạo Firebase Project

1. Truy cập [https://console.firebase.google.com](https://console.firebase.google.com)
2. **Thêm project** → đặt tên `7800quiz-internal`
3. Tắt Google Analytics (không cần thiết cho app nội bộ)

### 1.2 Thêm app Android

1. Firebase Console → **Add app** → Android
2. **Android package name**: `com.bank7800.quiz` _(phải khớp `applicationId` trong `android/app/build.gradle`)_
3. Tải file `google-services.json` → đặt vào `apps/mobile/android/app/google-services.json`
4. Trong `android/build.gradle` thêm:
   ```groovy
   dependencies {
     classpath 'com.google.gms:google-services:4.4.0'
   }
   ```
5. Trong `android/app/build.gradle` thêm cuối file:
   ```groovy
   apply plugin: 'com.google.gms.google-services'
   ```

### 1.3 Thêm app iOS

1. Firebase Console → **Add app** → Apple
2. **Bundle ID**: `com.bank7800.quiz` _(phải khớp trong Xcode → Signing & Capabilities)_
3. Tải file `GoogleService-Info.plist` → đặt vào `apps/mobile/ios/Runner/GoogleService-Info.plist`
4. Mở Xcode → `Runner` target → **Signing & Capabilities** → **+ Capability** → `Push Notifications`
5. **Background Modes** → tích `Remote notifications`

### 1.4 Cấu hình APNs (iOS) — bắt buộc để iOS nhận được push

1. Apple Developer Portal → **Certificates, IDs & Profiles** → **Keys** → tạo key với **Apple Push Notifications service (APNs)**
2. Tải file `.p8`
3. Firebase Console → Project Settings → Cloud Messaging → **Apple app configuration** → upload file `.p8`

### 1.5 Cấu hình Server (NestJS)

1. Firebase Console → **Project Settings** → tab **Service accounts**
2. Click **Generate new private key** → tải file JSON
3. Mở file JSON → copy toàn bộ nội dung → paste vào `.env` (dạng 1 dòng JSON):
   ```env
   FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"7800quiz-internal","private_key_id":"abc...","private_key":"-----BEGIN RSA PRIVATE KEY-----\n...","client_email":"firebase-adminsdk-xxx@7800quiz-internal.iam.gserviceaccount.com","client_id":"...","auth_uri":"...","token_uri":"..."}
   ```
   > **Lưu ý bảo mật**: Không commit file JSON vào Git. File `.env` đã được thêm vào `.gitignore`.

### 1.6 Kiểm tra

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

## 2. Phân phối iOS nội bộ (ABM/MDM) {#ios-mdm}

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
   flutter build ipa --release
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
flutter build ipa --release \
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

## 3. Phân phối Android nội bộ (MDM / APK) {#android-mdm}

### Phương án A: Managed Google Play (khuyến nghị dài hạn)

1. **Google Workspace** → Admin Console → **Devices** → **Apps** → **Managed Google Play**
2. Upload APK dạng **Private App**
3. Phân phối cho managed devices qua MDM policy

```bash
# Build APK release
cd apps/mobile
flutter build apk --release --split-per-abi
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

## Cấu hình Build (Android)

Sửa `apps/mobile/android/app/build.gradle`:

```groovy
android {
    defaultConfig {
        applicationId "com.bank7800.quiz"  // ← package name chính thức
        minSdkVersion 21
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
    }
    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_PATH") ?: "keystore.jks")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Tạo keystore (1 lần duy nhất):
```bash
keytool -genkeypair -v \
  -keystore apps/mobile/android/app/keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias 7800quiz
```

> ⚠️ **Bảo mật**: Lưu `keystore.jks` ở nơi an toàn, KHÔNG commit vào Git.

---

## Checklist triển khai Production

- [ ] Đổi `JWT_SECRET` thành chuỗi ngẫu nhiên 64 ký tự
- [ ] Cấu hình PostgreSQL production (Windows Server native hoặc Docker)
- [ ] Cấu hình HTTPS cho API (nginx reverse proxy + SSL cert)
- [ ] Cấu hình Firebase project + upload `google-services.json` / `GoogleService-Info.plist`
- [ ] Set `FIREBASE_SERVICE_ACCOUNT_JSON` trên server
- [ ] Build APK/IPA release với signing certificate
- [ ] Đăng ký ABM hoặc Managed Google Play
- [ ] Setup MDM và assign app cho nhóm thiết bị nhân viên
- [ ] Test end-to-end: login → làm bài offline → sync → nhận push notification
