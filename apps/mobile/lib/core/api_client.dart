import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../features/auth/auth_provider.dart';
import 'env.dart';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: Env.apiUrl,
    connectTimeout: const Duration(seconds: 10),
    // Trước đây chỉ có connectTimeout — mất mạng SAU khi đã connect (ví dụ
    // server treo giữa chừng lúc chấm điểm) sẽ không bao giờ timeout.
    receiveTimeout: const Duration(seconds: 15),
    sendTimeout: const Duration(seconds: 15),
  ));

  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) {
      final token = ref.read(authStateProvider).token;
      if (token != null) options.headers['Authorization'] = 'Bearer $token';
      return handler.next(options);
    },
    onError: (err, handler) {
      final status = err.response?.statusCode;
      if (status == 401) {
        ref.read(authStateProvider.notifier).logout();
      } else if (status == 404) {
        // User record not found (e.g. after DB reset) → force re-login
        final data = err.response?.data;
        final msg = data is Map ? (data['message'] ?? '') : '';
        if (msg.toString().contains('dùng') || msg.toString().contains('user')) {
          ref.read(authStateProvider.notifier).logout();
        }
      }
      return handler.next(err);
    },
  ));

  return dio;
});
