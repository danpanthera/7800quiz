import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// ─── Ký release — đọc từ android/key.properties (không commit vào git) ───────
// Nếu chưa có file (chưa tạo keystore) → fallback về debug signing để
// `flutter build apk --release` vẫn chạy được trong lúc phát triển.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseSigning = keystorePropertiesFile.exists()
if (hasReleaseSigning) {
    keystoreProperties.load(keystorePropertiesFile.inputStream())
}

android {
    namespace = "com.vbalaichau.quiz"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // Bắt buộc cho flutter_local_notifications (plugin tự bật desugaring
        // cho chính nó, nhưng module app cũng phải bật theo).
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // Application ID chính thức — theo domain quiz.vbalaichau.com, KHÔNG đổi sau khi phát hành
        // (Firebase / MDM / Managed Google Play đều khoá theo ID này).
        applicationId = "com.vbalaichau.quiz"
        // minSdk 24 do local_auth (BiometricPrompt) + flutter_plugin_android_lifecycle yêu cầu.
        // Đây cũng là mặc định của Flutter 3.41 — không hạ xuống.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        multiDexEnabled = true
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hasReleaseSigning) {
                signingConfigs.getByName("release")
            } else {
                // Chưa có keystore thật — ký tạm bằng debug key để `flutter build
                // apk --release` vẫn chạy được. Xem DEPLOYMENT.md để tạo keystore.
                signingConfigs.getByName("debug")
            }
            // Giảm size APK cho phân phối nội bộ qua MDM. armeabi-v7a giữ lại cho
            // các máy Android cũ còn dùng trong ngân hàng; bỏ x86/x86_64 (chỉ dùng
            // cho emulator, đã có ở build debug không filter ABI).
            ndk {
                abiFilters += listOf("arm64-v8a", "armeabi-v7a")
            }
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}

// Chỉ áp dụng plugin Google Services khi đã có file cấu hình Firebase thật.
// CLAUDE.md cấm commit google-services.json — nhờ điều kiện này, clone sạch
// (chưa cấu hình Firebase) vẫn build được, push notification chỉ đơn giản tắt
// (notification_service.dart đã tự guard `Firebase.apps.isEmpty`).
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}
