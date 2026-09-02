import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'gamification_provider.dart';

class AchievementScreen extends ConsumerWidget {
  const AchievementScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progressAsync = ref.watch(userProgressProvider);

    return Scaffold(
      body: progressAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Lỗi: $e')),
        data: (progress) => _Body(progress: progress),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  final UserProgressData progress;
  const _Body({required this.progress});

  Color get _levelColor {
    try {
      final hex = progress.color.replaceAll('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    } catch (_) {
      return Colors.blueGrey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        // ── SliverAppBar với gradient màu cấp độ ────────────────────────
        SliverAppBar(
          expandedHeight: 220,
          pinned: true,
          backgroundColor: _levelColor,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: () => context.pop(),
          ),
          flexibleSpace: FlexibleSpaceBar(
            background: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [_levelColor, _levelColor.withValues(alpha: 0.6)],
                ),
              ),
              child: SafeArea(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Level badge
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: 0.2),
                        border: Border.all(color: Colors.white, width: 3),
                      ),
                      child: Center(
                        child: Text(
                          '${progress.level}',
                          style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      progress.levelName,
                      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      '${progress.xp.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')} XP tổng',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 14),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Hạng #${progress.rank} toàn hệ thống',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),

        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── XP Progress bar ─────────────────────────────────────
                _XpBar(progress: progress, levelColor: _levelColor),
                const SizedBox(height: 20),

                // ── Streak + Stats ──────────────────────────────────────
                Row(
                  children: [
                    _StatCard(icon: '🔥', label: 'Streak', value: '${progress.currentStreak} ngày', color: Colors.deepOrange),
                    const SizedBox(width: 12),
                    _StatCard(icon: '📝', label: 'Bài thi', value: '${progress.totalSubmissions}', color: Colors.blue),
                    const SizedBox(width: 12),
                    _StatCard(icon: '⚔️', label: 'Arena', value: '${progress.totalArenaWins} wins', color: Colors.purple),
                  ],
                ),
                const SizedBox(height: 24),

                // ── Leaderboard button ──────────────────────────────────
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.leaderboard),
                    label: const Text('Xem bảng xếp hạng'),
                    onPressed: () => context.push('/leaderboard'),
                  ),
                ),
                const SizedBox(height: 24),

                // ── Badges ──────────────────────────────────────────────
                Text(
                  'Huy hiệu (${progress.badges.length})',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                if (progress.badges.isEmpty)
                  const Text('Chưa có huy hiệu nào. Hãy bắt đầu thi để nhận huy hiệu đầu tiên! 🎯',
                      style: TextStyle(color: Colors.grey))
                else
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.85,
                    ),
                    itemCount: progress.badges.length,
                    itemBuilder: (_, i) => _BadgeCard(badge: progress.badges[i]),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _XpBar extends StatelessWidget {
  final UserProgressData progress;
  final Color levelColor;
  const _XpBar({required this.progress, required this.levelColor});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Tiến độ lên cấp ${progress.level + 1}',
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            Text('${progress.xpInCurrentLevel} / ${progress.xpInCurrentLevel + progress.xpToNext} XP',
                style: TextStyle(color: Colors.grey[600], fontSize: 12)),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: progress.percentToNext / 100.0),
            duration: const Duration(milliseconds: 800),
            curve: Curves.easeOutCubic,
            builder: (_, value, __) => LinearProgressIndicator(
              value: value,
              minHeight: 12,
              backgroundColor: Colors.grey[200],
              valueColor: AlwaysStoppedAnimation<Color>(levelColor),
            ),
          ),
        ),
        const SizedBox(height: 4),
        if (progress.xpToNext > 0)
          Text('Còn ${progress.xpToNext} XP để lên cấp tiếp theo',
              style: TextStyle(color: Colors.grey[500], fontSize: 12)),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String icon;
  final String label;
  final String value;
  final Color color;
  const _StatCard({required this.icon, required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Text(icon, style: const TextStyle(fontSize: 20)),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 15)),
            Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}

class _BadgeCard extends StatelessWidget {
  final BadgeData badge;
  const _BadgeCard({required this.badge});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.amber.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Placeholder — thay bằng SvgPicture.asset sau khi có artwork thực
          const Text('🏅', style: TextStyle(fontSize: 32)),
          const SizedBox(height: 4),
          Text(
            badge.name,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
