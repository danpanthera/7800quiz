import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
import '../../core/sync_manager.dart';
import '../auth/auth_provider.dart';

final assignmentsProvider = FutureProvider<List<dynamic>>((ref) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get('/me/assignments');
  return res.data as List;
});

// Bảng màu gradient cho từng card
const _kCardGradients = [
  [Color(0xFF1565C0), Color(0xFF42A5F5)],
  [Color(0xFF6A1B9A), Color(0xFFCE93D8)],
  [Color(0xFF00695C), Color(0xFF4DB6AC)],
  [Color(0xFFB71C1C), Color(0xFFEF9A9A)],
  [Color(0xFFE65100), Color(0xFFFFCC80)],
  [Color(0xFF1B5E20), Color(0xFF81C784)],
];

class QuizListScreen extends ConsumerStatefulWidget {
  const QuizListScreen({super.key});

  @override
  ConsumerState<QuizListScreen> createState() => _QuizListScreenState();
}

class _QuizListScreenState extends ConsumerState<QuizListScreen>
    with TickerProviderStateMixin {
  late final AnimationController _headerCtrl;
  late final AnimationController _arenaCtrl;
  late final Animation<double> _headerFade;
  late final Animation<Offset> _headerSlide;

  @override
  void initState() {
    super.initState();
    _headerCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..forward();
    _arenaCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);

    _headerFade = CurvedAnimation(parent: _headerCtrl, curve: Curves.easeOut);
    _headerSlide = Tween<Offset>(
      begin: const Offset(0, -0.2),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _headerCtrl, curve: Curves.easeOutCubic));
  }

  @override
  void dispose() {
    _headerCtrl.dispose();
    _arenaCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final assignments = ref.watch(assignmentsProvider);
    final syncState = ref.watch(syncManagerProvider);
    final auth = ref.watch(authStateProvider);
    ref.read(syncManagerProvider.notifier);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFFF0F4FF),
        body: RefreshIndicator(
          onRefresh: () => ref.refresh(assignmentsProvider.future),
          color: const Color(0xFF1565C0),
          child: CustomScrollView(
            physics: const BouncingScrollPhysics(
              parent: AlwaysScrollableScrollPhysics(),
            ),
            slivers: [
              _buildSliverAppBar(auth, syncState),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                sliver: assignments.when(
                  loading: () => const SliverFillRemaining(
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (e, _) => SliverFillRemaining(
                    child: _ErrorState(
                      error: e.toString(),
                      onRetry: () => ref.invalidate(assignmentsProvider),
                    ),
                  ),
                  data: (list) {
                    if (list.isEmpty) {
                      return const SliverFillRemaining(child: _EmptyState());
                    }
                    return SliverList.builder(
                      itemCount: list.length,
                      itemBuilder: (ctx, i) => _AssignmentCard(
                        assignment: list[i],
                        index: i,
                        onTap: () => context.push(
                          '/quizzes/${list[i]['quiz']['id']}',
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        floatingActionButton: _buildArenaFAB(),
      ),
    );
  }

  Widget _buildSliverAppBar(AuthState auth, SyncState syncState) {
    final displayName = auth.fullName?.isNotEmpty == true
        ? auth.fullName!
        : auth.username ?? '';

    return SliverAppBar(
      expandedHeight: 190,
      floating: false,
      pinned: true,
      stretch: true,
      backgroundColor: const Color(0xFF1565C0),
      systemOverlayStyle: SystemUiOverlayStyle.light,
      actions: [
        if (syncState.status == SyncStatus.syncing)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16, horizontal: 8),
            child: SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: Colors.white70,
              ),
            ),
          ),
        IconButton(
          icon: const Icon(Icons.star_rounded, color: Colors.white70),
          tooltip: 'Thành tích',
          onPressed: () => context.push('/achievement'),
        ),
        IconButton(
          icon: const Icon(Icons.logout_rounded, color: Colors.white70),
          tooltip: 'Đăng xuất',
          onPressed: () => _confirmLogout(),
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsets.only(left: 20, bottom: 14),
        title: const Text(
          'Bài thi của tôi',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
        stretchModes: const [StretchMode.zoomBackground, StretchMode.fadeTitle],
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF0D47A1), Color(0xFF1976D2), Color(0xFF42A5F5)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: SafeArea(
            child: FadeTransition(
              opacity: _headerFade,
              child: SlideTransition(
                position: _headerSlide,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 56),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(
                              Icons.account_balance_rounded,
                              color: Colors.white,
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 10),
                          const Text(
                            '7800Quiz',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const Spacer(),
                          if (syncState.pendingCount > 0)
                            _SyncChip(
                              count: syncState.pendingCount,
                              onTap: () =>
                                  ref.read(syncManagerProvider.notifier).sync(),
                            ),
                        ],
                      ),
                      const Spacer(),
                      Text(
                        'Xin chào, $displayName!',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Hôm nay bạn có bài thi nào?',
                        style: TextStyle(color: Colors.white70, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildArenaFAB() {
    return AnimatedBuilder(
      animation: _arenaCtrl,
      builder: (_, child) => Transform.scale(
        scale: 1.0 + _arenaCtrl.value * 0.04,
        child: child,
      ),
      child: FloatingActionButton.extended(
        onPressed: () => context.go('/arena/join'),
        backgroundColor: const Color(0xFFFFB300),
        foregroundColor: Colors.black87,
        elevation: 6,
        icon: const Icon(Icons.emoji_events_rounded, size: 22),
        label: const Text(
          'Đấu trường',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
        ),
      ),
    );
  }

  Future<void> _confirmLogout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Đăng xuất'),
        content: const Text('Bạn có chắc muốn đăng xuất?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Đăng xuất'),
          ),
        ],
      ),
    );
    if (ok == true) ref.read(authStateProvider.notifier).logout();
  }
}

// ─── Sync chip ───────────────────────────────────────────────────────────────

class _SyncChip extends StatelessWidget {
  final int count;
  final VoidCallback onTap;
  const _SyncChip({required this.count, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: const Color(0xFFFF6D00).withValues(alpha: 0.85),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_upload_rounded, size: 13, color: Colors.white),
            const SizedBox(width: 4),
            Text(
              '$count',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Assignment card ──────────────────────────────────────────────────────────

class _AssignmentCard extends StatefulWidget {
  final dynamic assignment;
  final int index;
  final VoidCallback onTap;

  const _AssignmentCard({
    required this.assignment,
    required this.index,
    required this.onTap,
  });

  @override
  State<_AssignmentCard> createState() => _AssignmentCardState();
}

class _AssignmentCardState extends State<_AssignmentCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _fade;
  late final Animation<Offset> _slide;
  bool _pressed = false;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.25),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));

    Future.delayed(Duration(milliseconds: 80 + widget.index * 70), () {
      if (mounted) _ctrl.forward();
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final quiz = widget.assignment['quiz'] as Map<String, dynamic>;
    final gradient = _kCardGradients[widget.index % _kCardGradients.length];
    final topic = (quiz['topic'] as String?) ?? '';
    final duration = quiz['durationMin']?.toString() ?? '?';
    final title = (quiz['title'] as String?) ?? 'Không có tiêu đề';

    return FadeTransition(
      opacity: _fade,
      child: SlideTransition(
        position: _slide,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: GestureDetector(
            onTapDown: (_) => setState(() => _pressed = true),
            onTapUp: (_) {
              setState(() => _pressed = false);
              widget.onTap();
            },
            onTapCancel: () => setState(() => _pressed = false),
            child: AnimatedScale(
              scale: _pressed ? 0.97 : 1.0,
              duration: const Duration(milliseconds: 120),
              curve: Curves.easeOut,
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: gradient[0].withValues(alpha: 0.18),
                      blurRadius: 18,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    // Left gradient accent + icon
                    Container(
                      width: 68,
                      height: 90,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: gradient,
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ),
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(16),
                          bottomLeft: Radius.circular(16),
                        ),
                      ),
                      child: const Icon(
                        Icons.quiz_rounded,
                        color: Colors.white,
                        size: 30,
                      ),
                    ),
                    // Content
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 14,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                                color: Color(0xFF1A1A2E),
                                height: 1.3,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 6,
                              runSpacing: 4,
                              children: [
                                if (topic.isNotEmpty)
                                  _InfoChip(
                                    icon: Icons.label_rounded,
                                    label: topic,
                                    color: gradient[0],
                                  ),
                                _InfoChip(
                                  icon: Icons.timer_rounded,
                                  label: '$duration phút',
                                  color: Colors.grey.shade600,
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(right: 14),
                      child: Icon(
                        Icons.chevron_right_rounded,
                        color: gradient[0].withValues(alpha: 0.6),
                        size: 22,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Info chip ────────────────────────────────────────────────────────────────

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _InfoChip({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Empty state ──────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(48),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: const BoxDecoration(
                color: Color(0xFFE3EDFF),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.assignment_outlined,
                size: 46,
                color: Color(0xFF1565C0),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Chưa có bài thi nào',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1A1A2E),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Bài thi sẽ xuất hiện ở đây khi\ngiảng viên phân công cho bạn.',
              style: TextStyle(color: Colors.grey, height: 1.6, fontSize: 14),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Error state ──────────────────────────────────────────────────────────────

class _ErrorState extends StatelessWidget {
  final String error;
  final VoidCallback onRetry;
  const _ErrorState({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 60, color: Colors.grey),
            const SizedBox(height: 16),
            const Text(
              'Không tải được dữ liệu',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              error,
              style: const TextStyle(color: Colors.grey),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Thử lại'),
            ),
          ],
        ),
      ),
    );
  }
}

