import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';
import '../router.dart';

// ─── Background handler (top-level function — bắt buộc) ──────────────────────

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Chạy trên isolate nền riêng biệt — KHÔNG kế thừa việc khởi tạo Firebase
  // đã làm trong main() (đó là isolate khác). Phải tự init lại ở đây, nếu
  // không mọi gọi tới Firebase.* trong handler sẽ throw "no Firebase App".
  await Firebase.initializeApp();
  // Firebase tự hiện notification hệ thống khi có payload `notification` —
  // không cần tự show local notification ở đây.
}

// ─── Local Notifications setup ────────────────────────────────────────────────

final _localNotifications = FlutterLocalNotificationsPlugin();

const _androidChannel = AndroidNotificationChannel(
  '7800quiz_channel',
  '7800Quiz Thông báo',
  description: 'Thông báo đợt thi và nhắc nhở từ 7800Quiz',
  importance: Importance.high,
);

// ─── Notification Service ─────────────────────────────────────────────────────

class NotificationService {
  final Ref _ref;
  NotificationService(this._ref);

  // init() giờ được gọi cả sau login (login_screen) lẫn khi app khởi động
  // lại với token đã lưu (app_bootstrap.dart) — cần idempotent để không
  // đăng ký listener/channel trùng lặp.
  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;
    // Guard: Firebase chưa được cấu hình (không có google-services.json /
    // GoogleService-Info.plist) → bỏ qua, toàn bộ tính năng push tự tắt.
    if (Firebase.apps.isEmpty) return;
    _initialized = true;

    // 1. Khởi tạo local notifications
    await _localNotifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
    );

    // Tạo Android notification channel
    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_androidChannel);

    // 2. Xin quyền thông báo
    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Chỉ chặn khi user từ chối hẳn — `notDetermined`/`provisional` vẫn nên
    // thử lấy token (iOS provisional cho phép gửi âm thầm không cần hỏi).
    if (settings.authorizationStatus == AuthorizationStatus.denied) return;

    // 3. Lấy và đăng ký FCM token
    await _registerToken();

    // Cập nhật token khi token mới được cấp
    FirebaseMessaging.instance.onTokenRefresh.listen(_sendTokenToServer);

    // 4. Xử lý notification khi app ở foreground
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // 5. Xử lý khi user tap notification (app đang chạy nền, chưa terminated)
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    // 6. App bị mở LẠI TỪ ĐẦU do tap notification lúc terminated —
    // onMessageOpenedApp ở trên không bắt được trường hợp này.
    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) _handleNotificationTap(initialMessage);

    // Background handler đã đăng ký sớm trong main() (trước runApp) — không
    // đăng ký lại ở đây để tránh nhầm lẫn về nơi handler thực sự chạy.
  }

  Future<void> _registerToken() async {
    // iOS/macOS: FCM cần APNS token sẵn sàng TRƯỚC khi getToken() mới trả về
    // giá trị hợp lệ — bỏ qua bước này là nguyên nhân phổ biến khiến
    // getToken() trả null hoặc throw trên thiết bị iOS thật.
    if (!kIsWeb && (Platform.isIOS || Platform.isMacOS)) {
      String? apnsToken;
      for (var attempt = 0; attempt < 3 && apnsToken == null; attempt++) {
        apnsToken = await FirebaseMessaging.instance.getAPNSToken();
        if (apnsToken == null) await Future.delayed(const Duration(seconds: 1));
      }
      if (apnsToken == null) return; // Chưa có APNS token — thử lại ở onTokenRefresh
    }

    final token = await FirebaseMessaging.instance.getToken();
    if (token != null) await _sendTokenToServer(token);
  }

  Future<void> _sendTokenToServer(String token) async {
    try {
      final dio = _ref.read(dioProvider);
      await dio.put('/me/fcm-token', data: {'token': token});
    } on DioException {
      // Silent fail — sẽ retry lần sau
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;

    _localNotifications.show(
      message.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _androidChannel.id,
          _androidChannel.name,
          channelDescription: _androidChannel.description,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
    );
  }

  void _handleNotificationTap(RemoteMessage message) {
    // Payload từ server (notifications.service.ts) chỉ có `sessionId` (id của
    // ExamSession) + `type: 'EXAM_OPENED'` — không có quizId trực tiếp nên
    // KHÔNG thể điều hướng thẳng vào /quizzes/:id (route đó cần quizId thật).
    // Đưa về danh sách bài được giao — an toàn, người dùng tự chọn đúng bài.
    try {
      _ref.read(routerProvider).go('/quizzes');
    } catch (_) {
      // Router chưa gắn vào cây widget (app vừa khởi động, frame đầu chưa
      // build xong) — bỏ qua, người dùng vẫn thấy app ở màn hình mặc định.
    }
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

final notificationServiceProvider = Provider<NotificationService>((ref) {
  return NotificationService(ref);
});
