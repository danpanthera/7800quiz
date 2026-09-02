import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/app_bootstrap.dart';
import 'core/notification_service.dart';
import 'router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
  ));

  try {
    // TODO(Firebase — hoãn theo quyết định 2026-09-02): khi cấu hình Firebase
    // thật, chạy `flutterfire configure` (sinh lib/firebase_options.dart) rồi
    // đổi dòng dưới thành:
    //   await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    // Hiện tại initializeApp() không tham số, dựa hoàn toàn vào file cấu hình
    // native (google-services.json / GoogleService-Info.plist). Thiếu file
    // native trên Android/iOS thật sẽ khiến dòng này throw — bị bắt ở catch
    // bên dưới, mọi tính năng push tự tắt (guard ở
    // notification_service.dart: `if (Firebase.apps.isEmpty) return;`).
    await Firebase.initializeApp();

    // Bắt buộc đăng ký TRƯỚC runApp() — nếu đăng ký muộn (như trước đây, ở
    // cuối NotificationService.init()) thì app sẽ KHÔNG nhận được message
    // khi ở trạng thái terminated (chưa từng mở), vì Firebase cần handler
    // này sẵn sàng trước khi engine Dart khởi động lại ở isolate nền.
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  } catch (e, st) {
    // Trước đây `catch (_) {}` nuốt lỗi hoàn toàn — không cách nào biết vì
    // sao push không hoạt động khi debug trên máy thật.
    debugPrint('[Firebase] Chưa cấu hình hoặc khởi tạo lỗi — push notification sẽ tắt: $e');
    if (kDebugMode) debugPrintStack(stackTrace: st);
  }

  runApp(const ProviderScope(child: AppBootstrap(child: App())));
}

class App extends ConsumerWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: '7800Quiz',
      debugShowCheckedModeBanner: false,
      theme: _buildTheme(),
      routerConfig: router,
    );
  }

  ThemeData _buildTheme() {
    const primaryBlue = Color(0xFF1565C0);
    const goldAccent = Color(0xFFFFB300);

    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryBlue,
        primary: primaryBlue,
        secondary: goldAccent,
        surface: const Color(0xFFF5F7FF),
        onPrimary: Colors.white,
        onSecondary: Colors.black87,
      ),
      scaffoldBackgroundColor: const Color(0xFFF0F4FF),
      appBarTheme: const AppBarTheme(
        backgroundColor: primaryBlue,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        systemOverlayStyle: SystemUiOverlayStyle.light,
        titleTextStyle: TextStyle(
          color: Colors.white,
          fontSize: 20,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
        ),
      ),
      cardTheme: const CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
        ),
        color: Colors.white,
        shadowColor: Colors.transparent,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: primaryBlue,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(vertical: 15),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(vertical: 15),
          side: const BorderSide(color: primaryBlue),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFDDE4F5)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFDDE4F5)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primaryBlue, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.red),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.red, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        prefixIconColor: const Color(0xFF5C7099),
        suffixIconColor: const Color(0xFF5C7099),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: goldAccent,
        foregroundColor: Colors.black87,
        elevation: 4,
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      dialogTheme: const DialogThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(20)),
        ),
        elevation: 8,
      ),
    );
  }
}
