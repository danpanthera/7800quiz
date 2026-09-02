/// Cấu hình môi trường — gom tất cả biến truyền qua `--dart-define-from-file`
/// vào một chỗ, thay vì rải rác String.fromEnvironment ở nhiều file.
///
/// Cách dùng (xem thư mục env/ ở gốc apps/mobile/):
///   flutter run --dart-define-from-file=env/dev.json        # web-server, iOS Simulator
///   flutter run --dart-define-from-file=env/emulator.json   # Android Emulator (10.0.2.2)
///   flutter run --dart-define-from-file=env/lan.json        # máy thật trong LAN (gitignored, IP riêng máy dev)
///   flutter build apk --dart-define-from-file=env/prod.json # release, domain HTTPS thật
class Env {
  Env._();

  /// Base URL REST API, ví dụ http://localhost:13010/api hoặc
  /// https://quiz.vbalaichau.com/api. Mặc định dùng cho `flutter run` không
  /// truyền define nào (web-server dev trên chính máy chạy API).
  static const apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://localhost:13010/api',
  );

  /// Cho phép override thủ công nếu WebSocket cần domain khác REST API
  /// (hiếm khi cần — để trống thì tự suy ra từ [apiUrl]).
  static const _wsOverride = String.fromEnvironment('WS_URL');

  /// Base URL Socket.IO (Arena) — server gắn ở path `/socket.io/` tại ROOT,
  /// NGOÀI prefix `/api` (xem apps/api/src/main.ts — setGlobalPrefix('api')
  /// chỉ áp dụng cho REST, IoAdapter dùng chung HTTP server ở root path).
  ///
  /// Dùng Uri.replace(path: '') thay vì `apiUrl.replaceAll('/api', '')` —
  /// cách cũ thay thế MỌI chuỗi con "/api" nên phá vỡ với domain kiểu
  /// "https://api-quiz.vbalaichau.com/api" (có "api" xuất hiện 2 lần).
  static String get wsUrl {
    if (_wsOverride.isNotEmpty) return _wsOverride;
    final uri = Uri.parse(apiUrl);
    return uri.replace(path: '', query: '', fragment: '').toString();
  }
}
