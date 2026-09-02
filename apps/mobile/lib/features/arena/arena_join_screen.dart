import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../core/api_client.dart';
import 'arena_provider.dart';

class ArenaJoinScreen extends ConsumerStatefulWidget {
  const ArenaJoinScreen({super.key});

  @override
  ConsumerState<ArenaJoinScreen> createState() => _ArenaJoinScreenState();
}

class _ArenaJoinScreenState extends ConsumerState<ArenaJoinScreen> {
  final _codeCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _codeCtrl.dispose();
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _join() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });

    try {
      final dio = ref.read(dioProvider);
      final code = _codeCtrl.text.trim().toUpperCase();

      // Fetch session info
      final res = await dio.get('/arena/join/$code');
      final data = res.data as Map<String, dynamic>;

      if (data['status'] != 'LOBBY') {
        setState(() { _error = 'Phiên đấu đã bắt đầu hoặc kết thúc.'; _loading = false; });
        return;
      }

      final teams = (data['teams'] as List? ?? [])
          .map((e) => ArenaTeam.fromJson(e as Map<String, dynamic>))
          .toList();

      // Connect socket + join team
      ref.read(arenaProvider.notifier).connectToSession(
        sessionId: data['id'] as String,
        joinCode: code,
        sessionName: data['name'] as String,
        quizTitle: (data['quiz'] as Map<String, dynamic>)['title'] as String,
        totalRounds: (data['_count'] as Map<String, dynamic>?)?['rounds'] as int? ?? 0,
        teamId: '', // will be set after socket join ack — we patch below
        teamName: _nameCtrl.text.trim(),
        teamColor: '#888888',
        existingTeams: teams,
      );

      if (mounted) context.go('/arena/lobby');
    } on DioException catch (e) {
      setState(() {
        _error = (e.response?.data as Map?)?['message'] as String? ?? 'Mã tham gia không hợp lệ';
        _loading = false;
      });
    } catch (_) {
      setState(() { _error = 'Có lỗi xảy ra. Vui lòng thử lại.'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1A1A2E),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: const Text('Tham gia Đấu trường'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          tooltip: 'Về trang chủ',
          onPressed: () => context.go('/quizzes'),
        ),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.emoji_events, size: 72, color: Color(0xFFFAD02C)),
                const SizedBox(height: 16),
                const Text('ĐẤU TRƯỜNG', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold, letterSpacing: 4)),
                const SizedBox(height: 32),
                // ── Mã tham gia ──
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text('Mã tham gia (6 ký tự)', style: TextStyle(color: Colors.white70, fontSize: 13)),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _codeCtrl,
                  style: const TextStyle(color: Colors.white, fontSize: 24, letterSpacing: 6, fontWeight: FontWeight.bold),
                  textCapitalization: TextCapitalization.characters,
                  textAlign: TextAlign.center,
                  maxLength: 6,
                  decoration: InputDecoration(
                    hintText: 'ABCDEF',
                    hintStyle: TextStyle(color: Colors.white.withOpacity(0.3), letterSpacing: 6),
                    counterStyle: const TextStyle(color: Colors.white38),
                    filled: true,
                    fillColor: Colors.white.withOpacity(0.07),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.white38)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFFAD02C), width: 2)),
                    errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.red)),
                    focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.red, width: 2)),
                  ),
                  validator: (v) => (v == null || v.trim().length != 6) ? 'Nhập đúng 6 ký tự' : null,
                  onFieldSubmitted: (_) => _join(),
                ),
                const SizedBox(height: 16),
                // ── Tên đội ──
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text('Tên đội', style: TextStyle(color: Colors.white70, fontSize: 13)),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _nameCtrl,
                  style: const TextStyle(color: Colors.white),
                  textCapitalization: TextCapitalization.words,
                  decoration: InputDecoration(
                    hintText: 'Nhập tên đội...',
                    hintStyle: TextStyle(color: Colors.white.withOpacity(0.3)),
                    filled: true,
                    fillColor: Colors.white.withOpacity(0.07),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.white38)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFFAD02C), width: 2)),
                    errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.red)),
                    focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.red, width: 2)),
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Nhập tên đội' : null,
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: Colors.red.withOpacity(0.2), borderRadius: BorderRadius.circular(8)),
                    child: Text(_error!, style: const TextStyle(color: Colors.red)),
                  ),
                ],
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _join,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFFAD02C),
                      foregroundColor: Colors.black,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _loading
                        ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2))
                        : const Text('THAM GIA', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
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
