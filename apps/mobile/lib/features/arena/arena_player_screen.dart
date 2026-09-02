import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'arena_provider.dart';

const _optionColors = [Color(0xFFE74C3C), Color(0xFF3498DB), Color(0xFF2ECC71), Color(0xFFF39C12)];
const _optionLetters = ['A', 'B', 'C', 'D'];

class ArenaPlayerScreen extends ConsumerWidget {
  const ArenaPlayerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(arenaProvider);

    ref.listen<ArenaState>(arenaProvider, (prev, next) {
      if (next.view == ArenaScreenView.result) {
        context.go('/arena/result');
      }
    });

    final q = state.currentQuestion;
    if (q == null) {
      return const Scaffold(
        backgroundColor: Color(0xFF1A1A2E),
        body: Center(child: CircularProgressIndicator(color: Colors.white)),
      );
    }

    final isRevealed = state.view == ArenaScreenView.revealed;
    final reveal = state.revealData;

    return Scaffold(
      backgroundColor: const Color(0xFF1A1A2E),
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Text('Câu ${q.order + 1}',
                      style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                  const Spacer(),
                  // Buzz count
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(20)),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.bolt, color: Color(0xFFFAD02C), size: 16),
                        const SizedBox(width: 4),
                        Text('${state.buzzedTeamNames.length}', style: const TextStyle(color: Colors.white, fontSize: 14)),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Question
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(color: Colors.white.withOpacity(0.08), borderRadius: BorderRadius.circular(16)),
                child: Text(q.content, style: const TextStyle(color: Colors.white, fontSize: 18, height: 1.4), textAlign: TextAlign.center),
              ),
            ),

            // Already answered / waiting
            if (state.hasAnswered && !isRevealed)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(30)),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white70)),
                      SizedBox(width: 10),
                      Text('Đã trả lời — chờ kết quả…', style: TextStyle(color: Colors.white70)),
                    ],
                  ),
                ),
              ),

            // Reveal explanation
            if (isRevealed && reveal?.explanation != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: Colors.blue.withOpacity(0.2), borderRadius: BorderRadius.circular(10)),
                  child: Text('💡 ${reveal!.explanation}', style: const TextStyle(color: Colors.lightBlueAccent, fontSize: 13)),
                ),
              ),

            const Spacer(),

            // Options
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: GridView.count(
                shrinkWrap: true,
                crossAxisCount: 2,
                childAspectRatio: 2.5,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                physics: const NeverScrollableScrollPhysics(),
                children: List.generate(q.options.length, (idx) {
                  final opt = q.options[idx];
                  final isSelected = state.selectedOptionIds.contains(opt.id);
                  final isCorrect = reveal?.correctOptionIds.contains(opt.id) ?? false;
                  final wasWrong = isRevealed && isSelected && !isCorrect;

                  Color bgColor = _optionColors[idx % _optionColors.length];
                  if (isRevealed) {
                    bgColor = isCorrect ? const Color(0xFF27AE60) : const Color(0xFF7F8C8D);
                  }

                  return GestureDetector(
                    onTap: (state.hasAnswered || isRevealed) ? null : () {
                      ref.read(arenaProvider.notifier).submitAnswer([opt.id]);
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 300),
                      decoration: BoxDecoration(
                        color: bgColor,
                        borderRadius: BorderRadius.circular(12),
                        border: isSelected
                            ? Border.all(color: Colors.white, width: 3)
                            : wasWrong
                                ? Border.all(color: Colors.red, width: 2)
                                : null,
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 36, height: double.infinity,
                            decoration: BoxDecoration(
                              color: Colors.black.withOpacity(0.2),
                              borderRadius: const BorderRadius.only(topLeft: Radius.circular(12), bottomLeft: Radius.circular(12)),
                            ),
                            child: Center(
                              child: isRevealed && isCorrect
                                  ? const Icon(Icons.check, color: Colors.white, size: 20)
                                  : Text(_optionLetters[idx], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                            ),
                          ),
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                              child: Text(opt.content, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600), maxLines: 2, overflow: TextOverflow.ellipsis),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              ),
            ),

            // Mini leaderboard after reveal
            if (isRevealed) ...[
              const SizedBox(height: 12),
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(12)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('🏆 Bảng điểm', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    ...state.teams.take(5).toList().asMap().entries.map((e) {
                      final team = e.value;
                      final isMe = team.name == state.teamName;
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2),
                        child: Row(
                          children: [
                            Text('#${e.key + 1}', style: const TextStyle(color: Colors.white54, fontSize: 12)),
                            const SizedBox(width: 6),
                            Text(team.name, style: TextStyle(color: isMe ? const Color(0xFFFAD02C) : Colors.white, fontSize: 13, fontWeight: isMe ? FontWeight.bold : FontWeight.normal)),
                            const Spacer(),
                            Text('${team.score}đ', style: const TextStyle(color: Colors.white, fontSize: 13)),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
