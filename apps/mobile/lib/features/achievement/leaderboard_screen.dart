import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
import '../auth/auth_provider.dart';

// ── DTO ───────────────────────────────────────────────────────────────────────

class LeaderboardEntry {
  final String userId;
  final String fullName;
  final String? departmentName;
  final int xp;
  final int level;
  final String levelName;

  const LeaderboardEntry({
    required this.userId,
    required this.fullName,
    this.departmentName,
    required this.xp,
    required this.level,
    required this.levelName,
  });

  factory LeaderboardEntry.fromJson(Map<String, dynamic> j) => LeaderboardEntry(
        userId: j['userId'] as String,
        fullName: j['fullName'] as String,
        departmentName: j['departmentName'] as String?,
        xp: (j['xp'] as num).toInt(),
        level: (j['level'] as num).toInt(),
        levelName: j['levelName'] as String? ?? '',
      );
}

// ── Provider ──────────────────────────────────────────────────────────────────

final leaderboardProvider = FutureProvider.family<List<LeaderboardEntry>, String>((ref, period) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get('/admin/leaderboard', queryParameters: {'period': period});
  final list = res.data as List;
  return list.map((e) => LeaderboardEntry.fromJson(e as Map<String, dynamic>)).toList();
});

// ── Screen ────────────────────────────────────────────────────────────────────

class LeaderboardScreen extends ConsumerStatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  ConsumerState<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends ConsumerState<LeaderboardScreen> {
  String _period = 'all';

  @override
  Widget build(BuildContext context) {
    final dataAsync = ref.watch(leaderboardProvider(_period));
    final myId = ref.watch(authStateProvider).userId;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ─────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    onPressed: () => context.pop(),
                  ),
                  const Expanded(
                    child: Text(
                      'BẢNG XẾP HẠNG',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 2),
                    ),
                  ),
                  const SizedBox(width: 48),
                ],
              ),
            ),

            // ── Period filter ──────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SegmentedButton<String>(
                style: ButtonStyle(
                  backgroundColor: WidgetStateProperty.resolveWith((states) {
                    if (states.contains(WidgetState.selected)) return const Color(0xFFF59E0B);
                    return const Color(0xFF1E293B);
                  }),
                  foregroundColor: WidgetStateProperty.resolveWith((states) {
                    if (states.contains(WidgetState.selected)) return Colors.black;
                    return Colors.white70;
                  }),
                ),
                segments: const [
                  ButtonSegment(value: 'all', label: Text('Toàn thời gian')),
                  ButtonSegment(value: 'month', label: Text('Tháng này')),
                  ButtonSegment(value: 'week', label: Text('Tuần này')),
                ],
                selected: {_period},
                onSelectionChanged: (v) => setState(() => _period = v.first),
              ),
            ),

            const SizedBox(height: 16),

            // ── List ──────────────────────────────────────────────────
            Expanded(
              child: dataAsync.when(
                loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B))),
                error: (e, _) => Center(child: Text('Lỗi: $e', style: const TextStyle(color: Colors.red))),
                data: (entries) {
                  if (entries.isEmpty) {
                    return const Center(child: Text('Chưa có dữ liệu', style: TextStyle(color: Colors.white54)));
                  }
                  final top3 = entries.take(3).toList();
                  final rest = entries.skip(3).toList();

                  return ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    children: [
                      // Top 3 podium
                      _Podium(top3: top3, myId: myId),
                      const SizedBox(height: 16),
                      // Rank 4+
                      ...rest.asMap().entries.map((e) => _RankRow(
                            rank: e.key + 4,
                            entry: e.value,
                            isMe: e.value.userId == myId,
                          )),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Podium ────────────────────────────────────────────────────────────────────

class _Podium extends StatelessWidget {
  final List<LeaderboardEntry> top3;
  final String? myId;
  const _Podium({required this.top3, this.myId});

  @override
  Widget build(BuildContext context) {
    if (top3.isEmpty) return const SizedBox.shrink();
    final first = top3[0];
    final second = top3.length > 1 ? top3[1] : null;
    final third = top3.length > 2 ? top3[2] : null;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1E293B), Color(0xFF334155)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (second != null) _PodiumBlock(rank: 2, entry: second, height: 80, isMe: second.userId == myId),
          _PodiumBlock(rank: 1, entry: first, height: 110, isMe: first.userId == myId),
          if (third != null) _PodiumBlock(rank: 3, entry: third, height: 60, isMe: third.userId == myId),
        ],
      ),
    );
  }
}

class _PodiumBlock extends StatelessWidget {
  final int rank;
  final LeaderboardEntry entry;
  final double height;
  final bool isMe;
  const _PodiumBlock({required this.rank, required this.entry, required this.height, required this.isMe});

  Color get _medalColor => switch (rank) {
        1 => const Color(0xFFFFD700),
        2 => const Color(0xFFC0C0C0),
        _ => const Color(0xFFCD7F32),
      };

  String get _medal => switch (rank) { 1 => '🥇', 2 => '🥈', _ => '🥉' };

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(_medal, style: TextStyle(fontSize: rank == 1 ? 28 : 22)),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: isMe ? _medalColor.withValues(alpha: 0.3) : Colors.transparent,
            border: isMe ? Border.all(color: _medalColor, width: 1.5) : null,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            children: [
              Text(
                entry.fullName.split(' ').last,
                style: TextStyle(
                  color: isMe ? _medalColor : Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text('${entry.xp} XP', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 10)),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Container(
          width: 60,
          height: height,
          decoration: BoxDecoration(
            color: _medalColor.withValues(alpha: 0.3),
            borderRadius: const BorderRadius.only(topLeft: Radius.circular(8), topRight: Radius.circular(8)),
          ),
          child: Align(
            alignment: Alignment.topCenter,
            child: Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text('#$rank', style: TextStyle(color: _medalColor, fontWeight: FontWeight.bold, fontSize: 16)),
            ),
          ),
        ),
      ],
    );
  }
}

// ── RankRow ───────────────────────────────────────────────────────────────────

class _RankRow extends StatelessWidget {
  final int rank;
  final LeaderboardEntry entry;
  final bool isMe;
  const _RankRow({required this.rank, required this.entry, required this.isMe});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isMe ? const Color(0xFF1E3A5F) : const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: isMe ? Border.all(color: Colors.blue, width: 1.5) : null,
      ),
      child: Row(
        children: [
          SizedBox(
            width: 32,
            child: Text(
              '#$rank',
              style: TextStyle(
                color: isMe ? Colors.blue[300] : Colors.white54,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.fullName + (isMe ? ' (Tôi)' : ''),
                  style: TextStyle(
                    color: isMe ? Colors.blue[200] : Colors.white,
                    fontWeight: isMe ? FontWeight.bold : FontWeight.normal,
                  ),
                ),
                if (entry.departmentName != null)
                  Text(entry.departmentName!, style: const TextStyle(color: Colors.white38, fontSize: 12)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('${entry.xp} XP', style: const TextStyle(color: Color(0xFFF59E0B), fontWeight: FontWeight.bold)),
              Text(entry.levelName, style: const TextStyle(color: Colors.white38, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }
}
