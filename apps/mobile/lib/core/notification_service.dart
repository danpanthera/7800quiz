import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';

// ─── Background handler (top-level function — bắt buộc) ──────────────────────

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Xử lý notification khi app ở background/terminated
  // Firebase tự hiện notification — không cần làm gì thêm ở đây
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

  Future<void> init() async {
    // Guard: Firebase chưa được cấu hình (không có google-services.json) → bỏ qua
    if (Firebase.apps.isEmpty) return;

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

    if (settings.authorizationStatus == AuthorizationStatus.denied) return;

    // 3. Lấy và đăng ký FCM token
    await _registerToken();

    // Cập nhật token khi token mới được cấp
    FirebaseMessaging.instance.onTokenRefresh.listen(_sendTokenToServer);

    // 4. Xử lý notification khi app ở foreground
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // 5. Xử lý khi user tap notification (app ở background)
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    // 6. Background handler
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  }

  Future<void> _registerToken() async {
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
    // TODO: Navigate đến màn hình quiz tương ứng
    // Dùng GoRouter để navigate: context.go('/quizzes/${message.data['sessionId']}')
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

final notificationServiceProvider = Provider<NotificationService>((ref) {
  return NotificationService(ref);
});
