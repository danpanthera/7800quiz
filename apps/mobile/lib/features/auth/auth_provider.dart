import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

class AuthState {
  final String? token;
  final String? userId;
  final String? username;
  final String? fullName;
  final String? role;
  final bool mustChangePassword;

  const AuthState({
    this.token,
    this.userId,
    this.username,
    this.fullName,
    this.role,
    this.mustChangePassword = false,
  });

  bool get isLoggedIn => token != null;

  AuthState copyWith({
    String? token,
    String? userId,
    String? username,
    String? fullName,
    String? role,
    bool? mustChangePassword,
  }) {
    return AuthState(
      token: token ?? this.token,
      userId: userId ?? this.userId,
      username: username ?? this.username,
      fullName: fullName ?? this.fullName,
      role: role ?? this.role,
      mustChangePassword: mustChangePassword ?? this.mustChangePassword,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final FlutterSecureStorage _storage;
  final LocalAuthentication _localAuth = LocalAuthentication();

  AuthNotifier(this._storage) : super(const AuthState()) {
    _load();
  }

  Future<void> _load() async {
    final token = await _storage.read(key: 'token');
    final userId = await _storage.read(key: 'userId');
    final username = await _storage.read(key: 'username');
    final fullName = await _storage.read(key: 'fullName');
    final role = await _storage.read(key: 'role');
    final mustChange = await _storage.read(key: 'mustChangePassword');
    if (token != null) {
      state = AuthState(
        token: token,
        userId: userId,
        username: username,
        fullName: fullName,
        role: role,
        mustChangePassword: mustChange == 'true',
      );
    }
  }

  Future<void> login({
    required String token,
    required String userId,
    required String username,
    required String fullName,
    required String role,
    required bool mustChangePassword,
  }) async {
    await _storage.write(key: 'token', value: token);
    await _storage.write(key: 'userId', value: userId);
    await _storage.write(key: 'username', value: username);
    await _storage.write(key: 'fullName', value: fullName);
    await _storage.write(key: 'role', value: role);
    await _storage.write(key: 'mustChangePassword', value: mustChangePassword.toString());
    state = AuthState(
      token: token,
      userId: userId,
      username: username,
      fullName: fullName,
      role: role,
      mustChangePassword: mustChangePassword,
    );
  }

  /// Gọi sau khi đổi mật khẩu thành công
  Future<void> setPasswordChanged() async {
    await _storage.write(key: 'mustChangePassword', value: 'false');
    state = state.copyWith(mustChangePassword: false);
  }

  Future<void> logout() async {
    await _storage.deleteAll();
    state = const AuthState();
  }

  // ── Biometric ──────────────────────────────────────────────────────────

  /// Kiểm tra device có hỗ trợ và đã enroll sinh trắc học chưa
  Future<bool> get isBiometricAvailable async {
    if (kIsWeb) return false;
    try {
      final canCheck = await _localAuth.canCheckBiometrics;
      final isDeviceSupported = await _localAuth.isDeviceSupported();
      return canCheck && isDeviceSupported;
    } catch (_) {
      return false;
    }
  }

  /// Kiểm tra user đã bật biometric chưa
  Future<bool> get isBiometricEnabled async {
    final val = await _storage.read(key: 'biometricEnabled');
    return val == 'true';
  }

  /// Bật biometric: lưu credentials để dùng khi auth thành công
  Future<void> enableBiometric(String username, String password) async {
    await _storage.write(key: 'biometricEnabled', value: 'true');
    await _storage.write(key: 'bioUsername', value: username);
    await _storage.write(key: 'bioPassword', value: password);
  }

  /// Tắt biometric
  Future<void> disableBiometric() async {
    await _storage.delete(key: 'biometricEnabled');
    await _storage.delete(key: 'bioUsername');
    await _storage.delete(key: 'bioPassword');
  }

  /// Lấy credentials lưu cho biometric
  Future<Map<String, String>?> getBiometricCredentials() async {
    final u = await _storage.read(key: 'bioUsername');
    final p = await _storage.read(key: 'bioPassword');
    if (u == null || p == null) return null;
    return {'username': u, 'password': p};
  }

  /// Thực hiện xác thực sinh trắc học
  Future<bool> authenticateWithBiometric() async {
    if (kIsWeb) return false;
    try {
      return await _localAuth.authenticate(
        localizedReason: 'Xác thực để đăng nhập vào 7800Quiz',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );
    } catch (_) {
      return false;
    }
  }
}

/// Tách riêng để test override được (xem test/widget_test.dart) và để cấu
/// hình bảo mật native ở một chỗ duy nhất.
///
/// - Android: `encryptedSharedPreferences: true` — mặc định của package chỉ
///   dùng EncryptedSharedPreferences khi App Bundle build, còn lại rơi về
///   SharedPreferences thường; bật tường minh để luôn mã hoá.
/// - iOS: `first_unlock` (thay mặc định `unlocked`) — SyncManager cần đọc
///   được token để đồng bộ nền ngay sau khi máy khởi động lại nhưng TRƯỚC
///   khi người dùng mở khoá màn hình lần đầu.
///
/// Không có rủi ro migration dữ liệu cũ: đây là lần đầu app chạy trên
/// Android/iOS thật (trước đó chỉ có Web/macOS), nên bật ngay từ đầu là thời
/// điểm duy nhất không làm ai bị đăng xuất ngoài ý muốn.
final secureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );
});

final authStateProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.watch(secureStorageProvider));
});

/// ChangeNotifier dùng cho GoRouter.refreshListenable
class AuthChangeNotifier extends ChangeNotifier {
  void notify() => notifyListeners();
}
