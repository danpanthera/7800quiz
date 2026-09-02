import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../features/auth/auth_provider.dart';
import 'notification_service.dart';

/// Bọc quanh App — lắng nghe [authStateProvider] và khởi tạo các service cần
/// token (đăng ký FCM) NGAY KHI có token, bất kể đó là do user vừa đăng nhập
/// hay do app khôi phục session cũ từ secure storage lúc khởi động.
///
/// AuthNotifier luôn khởi tạo state với token=null rồi mới nạp secure storage
/// bất đồng bộ trong `_load()` (xem auth_provider.dart) — nên "khôi phục
/// session cũ" cũng là một lần chuyển null → non-null giống hệt lúc login,
/// không cần xử lý riêng 2 trường hợp.
///
/// Trước đây NotificationService.init() chỉ được gọi thủ công ở login_screen
/// (2 chỗ) — user tắt app rồi mở lại (session vẫn còn hiệu lực) sẽ KHÔNG BAO
/// GIỜ đăng ký lại FCM token, và trên Android 13+ không bao giờ thấy prompt
/// xin quyền thông báo.
class AppBootstrap extends ConsumerWidget {
  const AppBootstrap({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen<AuthState>(authStateProvider, (previous, next) {
      final justGotToken = previous?.token == null && next.token != null;
      if (justGotToken) {
        ref.read(notificationServiceProvider).init();
      }
    });
    return child;
  }
}
