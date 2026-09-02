// Smoke test — trước đây file này vẫn là template counter mặc định của
// `flutter create` (tham chiếu class `MyApp` không tồn tại trong main.dart,
// class thật tên `App`) nên `flutter test` fail ngay ở bước biên dịch.
//
// App thật cần flutter_secure_storage (đọc token lúc khởi động, xem
// AuthNotifier._load() trong auth_provider.dart) — package này gọi
// MethodChannel thật, không có sẵn trong môi trường test nên phải mock kênh
// 'plugins.it_nomads.com/flutter_secure_storage' (xác nhận từ chính source
// của package, dùng chung tên cho cả Android lẫn iOS) trả về rỗng, tương
// đương "chưa đăng nhập".

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_7800quiz/main.dart';

void main() {
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');

  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
      switch (methodCall.method) {
        case 'readAll':
          return <String, String>{};
        default:
          return null; // read/write/delete/deleteAll... đều no-op → coi như rỗng
      }
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  testWidgets('Chưa đăng nhập → App điều hướng tới màn hình Đăng nhập', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: App()));
    // AuthNotifier._load() đọc secure storage bất đồng bộ rồi GoRouter mới
    // redirect — cần vài frame để ổn định thay vì chỉ 1 pump().
    await tester.pumpAndSettle();

    expect(find.text('Đăng nhập'), findsWidgets);
  });
}
