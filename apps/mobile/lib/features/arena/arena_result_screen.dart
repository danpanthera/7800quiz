import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'arena_provider.dart';

class ArenaResultScreen extends ConsumerWidget {
  const ArenaResultScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(arenaProvider);
    final ranking = state.finalRanking;
    final myTeam = ranking.firstWhere((t) => t.name == state.teamName, orElse: () => ranking.isNotEmpty ? ranking.last : const ArenaTeam(id: '', name: '?', color: '#888', score: 0));
    final myRank = myTeam.rank ?? ranking.length;

    final podium = ranking.take(3).toList();
    final encouragement = ranking.skip(3).toList();

    return Scaffold(
      backgroundColor: const Color(0xFF1A1A2E),
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Spacer(),
                  const Text('KẾT QUẢ ĐẤU TRƯỜNG', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold, letterSpacing: 2)),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.home, color: Colors.white70),
                    onPressed: () {
                      ref.read(arenaProvider.notifier).reset();
                      context.go('/quizzes');
                    },
                  ),
                ],
              ),
            ),

            // My result banner
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [_rankColor(myRank).withOpacity(0.6), _rankColor(myRank).withOpacity(0.2)]),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _rankColor(myRank), width: 2),
              ),
              child: Row(
                children: [
                  Text(_rankEmoji(myRank), style: const TextStyle(fontSize: 40)),
                  const SizedBox(width: 16),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(myTeam.name, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                      Text('Hạng #$myRank — ${myTeam.score} điểm', style: const TextStyle(color: Colors.white70, fontSize: 15)),
                    ],
                  ),
                ],
              ),
            ),

            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 16),
                    const Text('🏆 Bảng xếp hạng', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),

                    // Podium top 3
                    if (podium.length >= 2)
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          if (podium.length >= 2) Expanded(child: _PodiumBlock(team: podium[1], heightFactor: 0.75)),
                          if (podium.isNotEmpty) Expanded(child: _PodiumBlock(team: podium[0], heightFactor: 1.0)),
                          if (podium.length >= 3) Expanded(child: _PodiumBlock(team: podium[2], heightFactor: 0.6)),
                        ],
                      ),
                    const SizedBox(height: 20),

                    // Full list
                    ...ranking.map((team) {
                      final rank = team.rank ?? ranking.indexOf(team) + 1;
                      final isMe = team.name == state.teamName;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: isMe ? _colorFromHex(team.color).withOpacity(0.3) : Colors.white.withOpacity(0.05),
                          borderRadius: BorderRadius.circular(10),
                          border: isMe ? Border.all(color: _colorFromHex(team.color), width: 2) : null,
                        ),
                        child: Row(
                          children: [
                            Text(_rankEmoji(rank), style: const TextStyle(fontSize: 24)),
                            const SizedBox(width: 12),
                            CircleAvatar(backgroundColor: _colorFromHex(team.color), radius: 16,
                                child: Text(team.name[0].toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold))),
                            const SizedBox(width: 10),
                            Expanded(child: Text(team.name, style: TextStyle(color: isMe ? const Color(0xFFFAD02C) : Colors.white, fontWeight: isMe ? FontWeight.bold : FontWeight.normal, fontSize: 15))),
                            Text('${team.score}', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                            const SizedBox(width: 4),
                            const Text('điểm', style: TextStyle(color: Colors.white54, fontSize: 12)),
                          ],
                        ),
                      );
                    }),

                    if (encouragement.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      const Center(child: Text('🏅 Khuyến khích', style: TextStyle(color: Colors.white54, fontSize: 13))),
                    ],
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PodiumBlock extends StatelessWidget {
  final ArenaTeam team;
  final double heightFactor;
  const _PodiumBlock({required this.team, required this.heightFactor});

  @override
  Widget build(BuildContext context) {
    final rank = team.rank ?? 1;
    return Column(
      children: [
        Text(_rankEmoji(rank), style: TextStyle(fontSize: heightFactor > 0.9 ? 36 : 28)),
        const SizedBox(height: 4),
        Text(team.name, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold), textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis),
        const SizedBox(height: 2),
        Text('${team.score}đ', style: const TextStyle(color: Colors.white70, fontSize: 12)),
        Container(
          height: 80 * heightFactor,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          decoration: BoxDecoration(
            color: _colorFromHex(team.color),
            borderRadius: const BorderRadius.only(topLeft: Radius.circular(6), topRight: Radius.circular(6)),
          ),
          child: Center(
            child: Text('#$rank', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20)),
          ),
        ),
      ],
    );
  }
}

String _rankEmoji(int rank) {
  if (rank == 1) return '🥇';
  if (rank == 2) return '🥈';
  if (rank == 3) return '🥉';
  return '🏅';
}

Color _rankColor(int rank) {
  if (rank == 1) return const Color(0xFFFFD700);
  if (rank == 2) return const Color(0xFFC0C0C0);
  if (rank == 3) return const Color(0xFFCD7F32);
  return Colors.blueGrey;
}

Color _colorFromHex(String hex) {
  try {
    return Color(int.parse('FF${hex.replaceAll('#', '')}', radix: 16));
  } catch (_) {
    return Colors.blueGrey;
  }
}
