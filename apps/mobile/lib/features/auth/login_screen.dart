import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../auth/auth_provider.dart';
import '../../core/api_client.dart';
import '../../core/notification_service.dart';

// ─── App metadata ─────────────────────────────────────────────────────────────
// Cập nhật khi phát hành phiên bản mới
const _kAppName    = '7800Quiz';
const _kVersion    = 'v1.0.0';
const _kAuthor     = 'datpanthera | 0912955113';
const _kCopyright  = '© 2025';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _loading = false;
  bool _showPassword = false;
  String? _error;
  bool _biometricAvailable = false;
  bool _biometricEnabled = false;

  @override
  void initState() {
    super.initState();
    _checkBiometric();
  }

  Future<void> _checkBiometric() async {
    final notifier = ref.read(authStateProvider.notifier);
    final available = await notifier.isBiometricAvailable;
    final enabled = await notifier.isBiometricEnabled;
    if (mounted) {
      setState(() {
        _biometricAvailable = available;
        _biometricEnabled = enabled;
      });
    }
  }

  Future<void> _doLogin(String username, String password) async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.post('/auth/login', data: {
        'username': username,
        'password': password,
      });
      final data = res.data;
      final mustChange = data['user']['mustChangePassword'] == true;
      await ref.read(authStateProvider.notifier).login(
        token: data['accessToken'],
        userId: data['user']['id'],
        username: data['user']['username'],
        fullName: data['user']['fullName'],
        role: data['user']['role'],
        mustChangePassword: mustChange,
      );
      // Khởi tạo push notification sau khi login thành công
      await ref.read(notificationServiceProvider).init();
    } on DioException catch (e) {
      setState(() => _error = e.response?.data?['message'] ?? 'Đăng nhập thất bại');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;
    await _doLogin(_usernameCtrl.text.trim(), _passwordCtrl.text);
  }

  Future<void> _loginWithBiometric() async {
    final notifier = ref.read(authStateProvider.notifier);
    setState(() { _loading = true; _error = null; });
    try {
      final authenticated = await notifier.authenticateWithBiometric();
      if (!authenticated) {
        setState(() { _error = 'Xác thực sinh trắc học thất bại'; _loading = false; });
        return;
      }
      final creds = await notifier.getBiometricCredentials();
      if (creds == null) {
        setState(() { _error = 'Không tìm thấy thông tin đăng nhập'; _loading = false; });
        return;
      }
      await _doLogin(creds['username']!, creds['password']!);
    } catch (e) {
      setState(() { _error = 'Lỗi sinh trắc học: $e'; _loading = false; });
    }
  }

  Future<void> _toggleBiometric() async {
    final notifier = ref.read(authStateProvider.notifier);
    if (_biometricEnabled) {
      await notifier.disableBiometric();
      setState(() => _biometricEnabled = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Đã tắt đăng nhập sinh trắc học')));
    } else {
      // Cần đăng nhập bằng password trước để lưu credentials
      if (!_formKey.currentState!.validate()) return;
      setState(() { _loading = true; _error = null; });
      try {
        final dio = ref.read(dioProvider);
        final res = await dio.post('/auth/login', data: {
          'username': _usernameCtrl.text.trim(),
          'password': _passwordCtrl.text,
        });
        final data = res.data;
        // Xác thực sinh trắc để confirm bật
        final ok = await notifier.authenticateWithBiometric();
        if (!ok) {
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Hủy bởi người dùng')));
          setState(() => _loading = false);
          return;
        }
        await notifier.enableBiometric(_usernameCtrl.text.trim(), _passwordCtrl.text);
        setState(() { _biometricEnabled = true; _loading = false; });
        // Thực hiện login luôn
        final mustChange = data['user']['mustChangePassword'] == true;
        await notifier.login(
          token: data['accessToken'],
          userId: data['user']['id'],
          username: data['user']['username'],
          fullName: data['user']['fullName'],
          role: data['user']['role'],
          mustChangePassword: mustChange,
        );
        await ref.read(notificationServiceProvider).init();
      } on DioException catch (e) {
        setState(() { _error = e.response?.data?['message'] ?? 'Đăng nhập thất bại'; _loading = false; });
      }
    }
  }

  @override
  void dispose() {
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF0D2857), Color(0xFF1565C0), Color(0xFF1E88E5)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Stack(
            children: [
              // ── Main scrollable content ───────────────────────────
              SafeArea(
                child: Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(24, 32, 24, 80),
                    child: Column(
                      children: [
                        // ── Logo area ──────────────────────────────
                        _LogoSection(),
                        const SizedBox(height: 32),
                    // ── White card ─────────────────────────────────────
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.18),
                            blurRadius: 40,
                            offset: const Offset(0, 12),
                          ),
                        ],
                      ),
                      padding: const EdgeInsets.fromLTRB(24, 28, 24, 28),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Đăng nhập',
                              style: TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0D2857),
                              ),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'Nhập thông tin tài khoản của bạn',
                              style: TextStyle(
                                color: Color(0xFF7A8EAA),
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 24),

                            // User AD
                            TextFormField(
                              controller: _usernameCtrl,
                              keyboardType: TextInputType.text,
                              textInputAction: TextInputAction.next,
                              decoration: const InputDecoration(
                                labelText: 'User AD (VD: datnguyentien2)',
                                hintText: 'User AD (VD: datnguyentien2)',
                                prefixIcon: Icon(Icons.badge_rounded),
                              ),
                              validator: (v) =>
                                  v!.isEmpty ? 'Vui lòng nhập User AD' : null,
                            ),
                            const SizedBox(height: 14),

                            // Mật khẩu
                            TextFormField(
                              controller: _passwordCtrl,
                              obscureText: !_showPassword,
                              textInputAction: TextInputAction.done,
                              onFieldSubmitted: (_) => _loading ? null : _login(),
                              decoration: InputDecoration(
                                labelText: 'Mật khẩu',
                                prefixIcon: const Icon(Icons.lock_rounded),
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _showPassword
                                        ? Icons.visibility_off_rounded
                                        : Icons.visibility_rounded,
                                  ),
                                  onPressed: () => setState(
                                    () => _showPassword = !_showPassword,
                                  ),
                                ),
                              ),
                              validator: (v) =>
                                  v!.isEmpty ? 'Vui lòng nhập mật khẩu' : null,
                            ),

                            // Error
                            if (_error != null) ...[
                              const SizedBox(height: 12),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFEBEE),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(
                                      Icons.error_outline_rounded,
                                      color: Colors.red,
                                      size: 16,
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        _error!,
                                        style: const TextStyle(
                                          color: Colors.red,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],

                            const SizedBox(height: 24),

                            // Login button (gradient)
                            SizedBox(
                              width: double.infinity,
                              height: 50,
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  gradient: _loading
                                      ? null
                                      : const LinearGradient(
                                          colors: [
                                            Color(0xFF1565C0),
                                            Color(0xFF1E88E5),
                                          ],
                                        ),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: FilledButton(
                                  style: FilledButton.styleFrom(
                                    backgroundColor: _loading
                                        ? Colors.grey.shade300
                                        : Colors.transparent,
                                    shadowColor: Colors.transparent,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                  onPressed: _loading ? null : _login,
                                  child: _loading
                                      ? const SizedBox(
                                          width: 22,
                                          height: 22,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2.5,
                                            color: Colors.white,
                                          ),
                                        )
                                      : const Text(
                                          'Đăng nhập',
                                          style: TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w700,
                                            color: Colors.white,
                                          ),
                                        ),
                                ),
                              ),
                            ),

                            // Biometric section
                            if (_biometricAvailable) ...[
                              const SizedBox(height: 20),
                              Row(
                                children: [
                                  const Expanded(child: Divider()),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 12),
                                    child: Text(
                                      'hoặc',
                                      style: TextStyle(
                                        color: Colors.grey.shade400,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                  const Expanded(child: Divider()),
                                ],
                              ),
                              const SizedBox(height: 16),
                              if (_biometricEnabled)
                                SizedBox(
                                  width: double.infinity,
                                  height: 48,
                                  child: OutlinedButton.icon(
                                    onPressed:
                                        _loading ? null : _loginWithBiometric,
                                    style: OutlinedButton.styleFrom(
                                      side: const BorderSide(
                                          color: Color(0xFF1565C0)),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                    ),
                                    icon: const Icon(
                                      Icons.fingerprint_rounded,
                                      size: 22,
                                    ),
                                    label: const Text(
                                        'Đăng nhập sinh trắc học'),
                                  ),
                                ),
                              const SizedBox(height: 12),
                              Center(
                                child: GestureDetector(
                                  onTap: _loading ? null : _toggleBiometric,
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.fingerprint_rounded,
                                        size: 15,
                                        color: Colors.grey.shade500,
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        _biometricEnabled
                                            ? 'Sinh trắc học: Bật'
                                            : 'Sinh trắc học: Tắt',
                                        style: TextStyle(
                                          color: Colors.grey.shade500,
                                          fontSize: 13,
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        _biometricEnabled ? '(Tắt)' : '(Bật)',
                                        style: const TextStyle(
                                          color: Color(0xFF1565C0),
                                          fontSize: 13,
                                          decoration: TextDecoration.underline,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                     ),
                   ),
                 ],
               ),
             ),
            ),
            ),
             // ── About footer — pinned to bottom ─────────────────
             const Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _AboutFooter(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Logo section ─────────────────────────────────────────────────────────────

class _LogoSection extends StatefulWidget {
  @override
  State<_LogoSection> createState() => _LogoSectionState();
}

class _LogoSectionState extends State<_LogoSection>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;
  late final Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..forward();
    _scale = Tween<double>(begin: 0.7, end: 1.0)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutBack));
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fade,
      child: ScaleTransition(
        scale: _scale,
        child: Column(
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.3),
                  width: 2,
                ),
              ),
              child: const Icon(
                Icons.account_balance_rounded,
                size: 40,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              '7800Quiz',
              style: TextStyle(
                color: Colors.white,
                fontSize: 30,
                fontWeight: FontWeight.w800,
                letterSpacing: 1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── About footer ─────────────────────────────────────────────────────────────
// Phong cách tham khảo: Telegram (tap counter), Slack (bottom-right subtle),
// 1Password ("Made with ♥"). Nhỏ, tinh tế, luôn hiển thị dưới cùng màn hình.

class _AboutFooter extends StatefulWidget {
  const _AboutFooter();

  @override
  State<_AboutFooter> createState() => _AboutFooterState();
}

class _AboutFooterState extends State<_AboutFooter>
    with SingleTickerProviderStateMixin {
  int _tapCount = 0;
  late final AnimationController _pulseCtrl;
  late final Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _pulseAnim = Tween<double>(begin: 1.0, end: 1.15).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  void _handleTap() {
    _pulseCtrl.forward().then((_) => _pulseCtrl.reverse());
    setState(() => _tapCount++);
    if (_tapCount >= 5) {
      setState(() => _tapCount = 0);
      _showAboutDialog();
    }
  }

  void _showAboutDialog() {
    showDialog<void>(
      context: context,
      builder: (_) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0D2857), Color(0xFF1E88E5)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(
                  Icons.account_balance_rounded,
                  size: 32,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                _kAppName,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0D2857),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _kVersion,
                style: const TextStyle(
                  fontSize: 13,
                  color: Color(0xFF7A8EAA),
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 16),
              const Divider(height: 1),
              const SizedBox(height: 14),
              _AboutRow(icon: Icons.code_rounded, label: 'Phần mềm', value: 'Ứng dụng thi nội bộ ngân hàng'),
              const SizedBox(height: 8),
              _AboutRow(icon: Icons.person_rounded, label: 'Tác giả', value: _kAuthor),
              const SizedBox(height: 8),
              _AboutRow(icon: Icons.calendar_today_rounded, label: 'Bản quyền', value: '$_kCopyright · $_kAuthor'),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF1565C0),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Đóng'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _handleTap,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: ScaleTransition(
            scale: _pulseAnim,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Tên phần mềm + phiên bản
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.account_balance_rounded,
                      size: 10,
                      color: Colors.white38,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      '$_kAppName  ·  $_kVersion',
                      style: const TextStyle(
                        color: Colors.white38,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                // Bản quyền & tác giả
                Text(
                  '$_kCopyright  $_kAuthor',
                  style: const TextStyle(
                    color: Colors.white24,
                    fontSize: 10,
                    letterSpacing: 0.2,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── About row helper ─────────────────────────────────────────────────────────

class _AboutRow extends StatelessWidget {
  const _AboutRow({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 15, color: const Color(0xFF7A8EAA)),
        const SizedBox(width: 8),
        Expanded(
          child: RichText(
            text: TextSpan(
              style: const TextStyle(fontSize: 13, color: Color(0xFF7A8EAA)),
              children: [
                TextSpan(text: '$label: '),
                TextSpan(
                  text: value,
                  style: const TextStyle(
                    color: Color(0xFF1A2F5A),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
