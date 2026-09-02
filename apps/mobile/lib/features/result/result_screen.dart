import 'dart:math';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
import '../../core/sync_manager.dart';
import '../achievement/gamification_provider.dart';
import '../achievement/level_up_dialog.dart';

final resultProvider =
    FutureProvider.family<Map<String, dynamic>?, String>((ref, id) async {
  try {
    final dio = ref.watch(dioProvider);
    final res = await dio.get('/results/$id');
    return res.data as Map<String, dynamic>;
  } on DioException catch (e) {
    // 404 = chưa sync lên server, trả về null để dùng điểm local
    if (e.response?.statusCode == 404) return null;
    rethrow;
  }
});

class ResultScreen extends ConsumerStatefulWidget {
  final String submissionId;
  final int? localCorrect;
  final int? localTotal;
  const ResultScreen({
    super.key,
    required this.submissionId,
    this.localCorrect,
    this.localTotal,
  });

  @override
  ConsumerState<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends ConsumerState<ResultScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scoreAnim;
  late final Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1200));
    _scoreAnim =
        CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic);
    _scaleAnim = Tween(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _controller, curve: Curves.elasticOut));
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final apiResult = ref.watch(resultProvider(widget.submissionId));

    // Lắng nghe gamification event (levelUp từ sync) → hiện LevelUpDialog
    ref.listen<Map<String, dynamic>?>(gamificationEventProvider, (_, event) {
      if (event == null) return;
      final levelUp = event['levelUp'] as bool? ?? false;
      if (!levelUp) return;
      final newLevel = (event['newLevel'] as num?)?.toInt() ?? 1;
      final levelName = event['levelName'] as String? ?? 'Cấp $newLevel';
      final rawBadges = event['newBadges'] as List? ?? [];
      final badgeNames = rawBadges
          .map((b) => (b as Map<String, dynamic>)['name'] as String? ?? '')
          .where((n) => n.isNotEmpty)
          .toList();
      // Reset event sau khi xử lý
      ref.read(gamificationEventProvider.notifier).state = null;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!context.mounted) return;
        LevelUpDialog.show(context, newLevel: newLevel, levelName: levelName, newBadgeNames: badgeNames);
      });
    });

    // Dùng local data trước (hiện ngay), sau đó dùng API data khi có
    final int correct = apiResult.valueOrNull != null
        ? ((apiResult.valueOrNull!['correctCount'] as num?)?.toInt() ??
            widget.localCorrect ??
            0)
        : (widget.localCorrect ?? 0);
    final int total = apiResult.valueOrNull != null
        ? ((apiResult.valueOrNull!['totalQuestions'] as num?)?.toInt() ??
            widget.localTotal ??
            1)
        : (widget.localTotal ?? 1);
    final double? apiScore =
        (apiResult.valueOrNull?['score'] as num?)?.toDouble();
    final double score = apiScore ?? (total > 0 ? correct / total * 100 : 0);
    final bool passed = apiResult.valueOrNull != null
        ? (apiResult.valueOrNull!['isPassed'] as bool? ?? score >= 60)
        : score >= 60;

    return Scaffold(
      backgroundColor: const Color(0xFF1A1A2E),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // ── Trophy / X icon ────────────────────────────────────
              ScaleTransition(
                scale: _scaleAnim,
                child: _TrophyWidget(passed: passed),
              ),
              const SizedBox(height: 32),
              // ── Score ring ─────────────────────────────────────────
              AnimatedBuilder(
                animation: _scoreAnim,
                builder: (context, _) {
                  final display = score * _scoreAnim.value;
                  return _ScoreRing(
                      score: display,
                      correct: correct,
                      total: total,
                      passed: passed);
                },
              ),
              const SizedBox(height: 32),
              // ── Status text ────────────────────────────────────────
              Text(
                passed ? 'Xuất sắc! Bạn đã đạt 🎉' : 'Cố lên! Làm lại nhé 💪',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                '$correct / $total câu đúng',
                style: const TextStyle(color: Colors.white60, fontSize: 15),
              ),
              const SizedBox(height: 16),
              // ── Sync status ───────────────────────────────────────
              _SyncStatusBar(submissionId: widget.submissionId),
              const SizedBox(height: 40),
              // ── Buttons ────────────────────────────────────────────
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => context.go('/quizzes'),
                  icon: const Icon(Icons.home_rounded),
                  label: const Text('Về trang chủ'),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF6366F1),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    textStyle: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Sync status bar ──────────────────────────────────────────────────────────
class _SyncStatusBar extends ConsumerWidget {
  final String submissionId;
  const _SyncStatusBar({required this.submissionId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final syncState = ref.watch(syncManagerProvider);
    final pending = syncState.pendingCount;
    final status = syncState.status;

    // Nếu đã sync xong (pending = 0) → hiển thị "Đã nộp lên server"
    if (pending == 0 && status != SyncStatus.syncing) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: const [
          Icon(Icons.cloud_done_rounded, color: Color(0xFF10B981), size: 18),
          SizedBox(width: 6),
          Text('Đã nộp lên server',
              style: TextStyle(color: Color(0xFF10B981), fontSize: 13)),
        ],
      );
    }

    // Đang sync
    if (status == SyncStatus.syncing) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: const [
          SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF6366F1)),
          ),
          SizedBox(width: 8),
          Text('Đang nộp lên server...',
              style: TextStyle(color: Colors.white54, fontSize: 13)),
        ],
      );
    }

    // Còn pending (chờ mạng hoặc lỗi)
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.cloud_upload_outlined, color: Colors.orange, size: 18),
        const SizedBox(width: 6),
        const Text('Chờ đồng bộ...',
            style: TextStyle(color: Colors.orange, fontSize: 13)),
        const SizedBox(width: 12),
        GestureDetector(
          onTap: () => ref.read(syncManagerProvider.notifier).sync(force: true),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.orange),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text('Thử lại',
                style: TextStyle(color: Colors.orange, fontSize: 12)),
          ),
        ),
      ],
    );
  }
}

// ─── Trophy widget ────────────────────────────────────────────────────────────
class _TrophyWidget extends StatelessWidget {
  final bool passed;
  const _TrophyWidget({required this.passed});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 100,
      height: 100,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: passed
            ? const Color(0xFF10B981).withOpacity(0.15)
            : const Color(0xFFEF4444).withOpacity(0.15),
        border: Border.all(
          color: passed ? const Color(0xFF10B981) : const Color(0xFFEF4444),
          width: 3,
        ),
      ),
      child: Icon(
        passed ? Icons.emoji_events_rounded : Icons.sentiment_dissatisfied_rounded,
        size: 54,
        color: passed ? const Color(0xFFFBBF24) : const Color(0xFFEF4444),
      ),
    );
  }
}

// ─── Score ring ───────────────────────────────────────────────────────────────
class _ScoreRing extends StatelessWidget {
  final double score;
  final int correct;
  final int total;
  final bool passed;
  const _ScoreRing(
      {required this.score,
      required this.correct,
      required this.total,
      required this.passed});

  @override
  Widget build(BuildContext context) {
    final color =
        passed ? const Color(0xFF10B981) : const Color(0xFFEF4444);
    return SizedBox(
      width: 160,
      height: 160,
      child: CustomPaint(
        painter: _RingPainter(progress: score / 100, color: color),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${score.toStringAsFixed(0)}%',
                style: TextStyle(
                    color: color,
                    fontSize: 32,
                    fontWeight: FontWeight.bold),
              ),
              Text(
                passed ? 'ĐẠT' : 'CHƯA ĐẠT',
                style: TextStyle(
                    color: color,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.5),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  final double progress;
  final Color color;
  const _RingPainter({required this.progress, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - 16) / 2;
    final bgPaint = Paint()
      ..color = Colors.white12
      ..style = PaintingStyle.stroke
      ..strokeWidth = 12
      ..strokeCap = StrokeCap.round;
    final fgPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 12
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(center, radius, bgPaint);
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -pi / 2,
      2 * pi * progress,
      false,
      fgPaint,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.progress != progress;
}
