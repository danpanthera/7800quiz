import 'package:confetti/confetti.dart';
import 'package:flutter/material.dart';

class LevelUpDialog extends StatefulWidget {
  final int newLevel;
  final String levelName;
  final List<String> newBadgeNames;

  const LevelUpDialog({
    super.key,
    required this.newLevel,
    required this.levelName,
    this.newBadgeNames = const [],
  });

  /// Hiển thị dialog lên cấp. Trả về true nếu người dùng đã đóng.
  static Future<void> show(
    BuildContext context, {
    required int newLevel,
    required String levelName,
    List<String> newBadgeNames = const [],
  }) {
    return showDialog(
      context: context,
      barrierDismissible: true,
      builder: (_) => LevelUpDialog(
        newLevel: newLevel,
        levelName: levelName,
        newBadgeNames: newBadgeNames,
      ),
    );
  }

  @override
  State<LevelUpDialog> createState() => _LevelUpDialogState();
}

class _LevelUpDialogState extends State<LevelUpDialog> with SingleTickerProviderStateMixin {
  late ConfettiController _confetti;
  late AnimationController _scale;
  late Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();
    _confetti = ConfettiController(duration: const Duration(seconds: 3));
    _scale = AnimationController(vsync: this, duration: const Duration(milliseconds: 500));
    _scaleAnim = CurvedAnimation(parent: _scale, curve: Curves.elasticOut);
    _confetti.play();
    _scale.forward();
  }

  @override
  void dispose() {
    _confetti.dispose();
    _scale.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.topCenter,
      children: [
        // Confetti
        ConfettiWidget(
          confettiController: _confetti,
          blastDirectionality: BlastDirectionality.explosive,
          numberOfParticles: 30,
          maxBlastForce: 20,
          minBlastForce: 8,
          gravity: 0.3,
          colors: const [
            Color(0xFFFFD700),
            Color(0xFF4CAF50),
            Color(0xFF2196F3),
            Color(0xFFE91E63),
            Color(0xFFFF9800),
          ],
        ),

        // Dialog
        AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          contentPadding: const EdgeInsets.all(24),
          content: ScaleTransition(
            scale: _scaleAnim,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Level badge
                Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFFD700), Color(0xFFF59E0B)],
                    ),
                    boxShadow: [
                      BoxShadow(color: const Color(0xFFFFD700).withValues(alpha: 0.4), blurRadius: 20, spreadRadius: 5),
                    ],
                  ),
                  child: Center(
                    child: Text(
                      '${widget.newLevel}',
                      style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                const Text(
                  '🎉 LÊN CẤP!',
                  style: TextStyle(color: Color(0xFFFFD700), fontSize: 22, fontWeight: FontWeight.bold, letterSpacing: 2),
                ),
                const SizedBox(height: 8),

                Text(
                  widget.levelName,
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text(
                  'Chúc mừng! Bạn đã đạt cấp ${widget.newLevel}',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 13),
                ),

                // New badges
                if (widget.newBadgeNames.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.amber.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                    ),
                    child: Column(
                      children: [
                        const Text('🏅 Huy hiệu mới!', style: TextStyle(color: Colors.amber, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        ...widget.newBadgeNames.map((n) => Text('• $n', style: const TextStyle(color: Colors.white70, fontSize: 13))),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFFFD700),
                      foregroundColor: Colors.black,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Tuyệt vời!', style: TextStyle(fontWeight: FontWeight.bold)),
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
