import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:go_router/go_router.dart';
import '../auth/auth_provider.dart';
import '../../core/api_client.dart';

class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _oldCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _loading = false;
  bool _showOld = false;
  bool _showNew = false;
  bool _showConfirm = false;
  String? _error;

  @override
  void dispose() {
    _oldCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });

    try {
      final dio = ref.read(dioProvider);
      await dio.post('/auth/change-password', data: {
        'oldPassword': _oldCtrl.text,
        'newPassword': _newCtrl.text,
      });

      await ref.read(authStateProvider.notifier).setPasswordChanged();

      // Cập nhật credentials biometric nếu đang bật
      final auth = ref.read(authStateProvider);
      final notifier = ref.read(authStateProvider.notifier);
      final bioEnabled = await notifier.isBiometricEnabled;
      if (bioEnabled && auth.username != null) {
        await notifier.enableBiometric(auth.username!, _newCtrl.text);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ Đổi mật khẩu thành công!'), backgroundColor: Colors.green),
        );
        context.go('/quizzes');
      }
    } on DioException catch (e) {
      setState(() => _error = e.response?.data?['message'] ?? 'Đổi mật khẩu thất bại');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Đổi mật khẩu'),
        automaticallyImplyLeading: false,
        actions: [
          TextButton(
            onPressed: () async {
              await ref.read(authStateProvider.notifier).logout();
            },
            child: const Text('Đăng xuất', style: TextStyle(color: Colors.white70)),
          ),
        ],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.lock_outline, size: 56, color: Colors.orange),
                const SizedBox(height: 16),
                Text(
                  'Đổi mật khẩu',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'Đây là lần đầu đăng nhập.\nVui lòng đặt mật khẩu mới để tiếp tục.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey[600]),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                TextFormField(
                  controller: _oldCtrl,
                  obscureText: !_showOld,
                  decoration: InputDecoration(
                    labelText: 'Mật khẩu hiện tại',
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      icon: Icon(_showOld ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _showOld = !_showOld),
                    ),
                  ),
                  validator: (v) => v!.isEmpty ? 'Nhập mật khẩu hiện tại' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _newCtrl,
                  obscureText: !_showNew,
                  decoration: InputDecoration(
                    labelText: 'Mật khẩu mới',
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      icon: Icon(_showNew ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _showNew = !_showNew),
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Nhập mật khẩu mới';
                    if (v.length < 6) return 'Tối thiểu 6 ký tự';
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _confirmCtrl,
                  obscureText: !_showConfirm,
                  decoration: InputDecoration(
                    labelText: 'Xác nhận mật khẩu mới',
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      icon: Icon(_showConfirm ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _showConfirm = !_showConfirm),
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Xác nhận mật khẩu';
                    if (v != _newCtrl.text) return 'Mật khẩu không khớp';
                    return null;
                  },
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Colors.red), textAlign: TextAlign.center),
                ],
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _loading ? null : _submit,
                  child: _loading
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Xác nhận đổi mật khẩu'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
