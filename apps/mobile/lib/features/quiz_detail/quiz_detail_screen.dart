import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';

final quizDetailProvider = FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get('/quiz/$id');
  return res.data as Map<String, dynamic>;
});

class QuizDetailScreen extends ConsumerWidget {
  final String quizId;
  const QuizDetailScreen({super.key, required this.quizId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(quizDetailProvider(quizId));

    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết bài thi')),
      body: detail.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Lỗi: $e')),
        data: (data) {
          final quiz = data['quiz'];
          final questions = data['questions'] as List;
          return Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(quiz['title'], style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                if (quiz['description'] != null) Text(quiz['description']),
                const SizedBox(height: 16),
                Row(children: [
                  const Icon(Icons.timer_outlined, size: 18),
                  const SizedBox(width: 4),
                  Text('${quiz['durationMin']} phút'),
                  const SizedBox(width: 16),
                  const Icon(Icons.quiz_outlined, size: 18),
                  const SizedBox(width: 4),
                  Text('${questions.length} câu hỏi'),
                ]),
                const Spacer(),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => context.push('/quizzes/$quizId/play'),
                    icon: const Icon(Icons.play_arrow),
                    label: const Text('Bắt đầu làm bài'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
