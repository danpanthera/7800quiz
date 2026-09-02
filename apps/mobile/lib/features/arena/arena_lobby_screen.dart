import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'arena_provider.dart';

class ArenaLobbyScreen extends ConsumerWidget {
  const ArenaLobbyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(arenaProvider);

    // Auto-navigate when game starts (view switches to playing)
    ref.listen<ArenaState>(arenaProvider, (prev, next) {
      if (next.view == ArenaScreenView.playing) {
        context.go('/arena/play');
      }
    });

    return Scaffold(
      backgroundColor: const Color(0xFF1A1A2E),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: Text(state.sessionName ?? 'Đấu trường'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            ref.read(arenaProvider.notifier).reset();
            context.go('/quizzes');
          },
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Quiz info
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.08), borderRadius: BorderRadius.circular(12)),
              child: Column(
                children: [
                  const Icon(Icons.quiz, color: Color(0xFFFAD02C), size: 32),
                  const SizedBox(height: 8),
                  Text(state.quizTitle ?? '', style: const TextStyle(color: Colors.white70, fontSize: 15), textAlign: TextAlign.center),
                  const SizedBox(height: 4),
                  Text('Mã phòng: ${state.joinCode ?? ''}',
                      style: const TextStyle(color: Color(0xFFFAD02C), fontSize: 20, fontWeight: FontWeight.bold, letterSpacing: 4)),
                ],
              ),
            ),
            const SizedBox(height: 24),
            // Team info
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _colorFromHex(state.teamColor ?? '#888').withOpacity(0.2),
                border: Border.all(color: _colorFromHex(state.teamColor ?? '#888'), width: 2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircleAvatar(backgroundColor: _colorFromHex(state.teamColor ?? '#888'), radius: 20,
                      child: Text((state.teamName ?? '?')[0].toUpperCase(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold))),
                  const SizedBox(width: 12),
                  Text('Đội: ${state.teamName ?? ''}', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(width: 8),
                  const Icon(Icons.check_circle, color: Colors.green, size: 20),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Text('Các đội đã vào (${state.teams.length}/9)',
                style: const TextStyle(color: Colors.white70, fontSize: 14)),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.builder(
                itemCount: state.teams.length,
                itemBuilder: (_, i) {
                  final team = state.teams[i];
                  final isMe = team.name == state.teamName;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(
                      color: _colorFromHex(team.color).withOpacity(isMe ? 0.3 : 0.1),
                      borderRadius: BorderRadius.circular(10),
                      border: isMe ? Border.all(color: _colorFromHex(team.color), width: 2) : null,
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(backgroundColor: _colorFromHex(team.color), radius: 16,
                            child: Text(team.name[0].toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 12))),
                        const SizedBox(width: 12),
                        Text(team.name, style: TextStyle(color: Colors.white, fontWeight: isMe ? FontWeight.bold : FontWeight.normal)),
                        if (isMe) ...[const SizedBox(width: 8), const Text('(bạn)', style: TextStyle(color: Colors.white54, fontSize: 12))],
                        const Spacer(),
                        const Icon(Icons.circle, color: Colors.green, size: 10),
                      ],
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(12)),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white38)),
                  SizedBox(width: 12),
                  Text('Chờ MC bắt đầu phiên đấu…', style: TextStyle(color: Colors.white54)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Color _colorFromHex(String hex) {
  try {
    final h = hex.replaceAll('#', '');
    return Color(int.parse('FF$h', radix: 16));
  } catch (_) {
    return Colors.blueGrey;
  }
}
