import 'dart:async';
import 'dart:math';
import 'package:confetti/confetti.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';
import '../../core/sync_manager.dart';
import '../quiz_detail/quiz_detail_screen.dart';

// ─── Màu Quizizz ─────────────────────────────────────────────────────────────
const _optionColors = [
  Color(0xFF6366F1), // Tím indigo
  Color(0xFFEC4899), // Hồng
  Color(0xFF10B981), // Xanh lá
  Color(0xFFF59E0B), // Vàng cam
];
const _optionIcons = [
  Icons.change_history_rounded, // tam giác
  Icons.diamond_rounded,
  Icons.circle_rounded,
  Icons.square_rounded,
];

// ─── Widget chính ──────────────────────────────────────────────────────────────
class QuizPlayerScreen extends ConsumerStatefulWidget {
  final String quizId;
  const QuizPlayerScreen({super.key, required this.quizId});

  @override
  ConsumerState<QuizPlayerScreen> createState() => _QuizPlayerScreenState();
}

class _QuizPlayerScreenState extends ConsumerState<QuizPlayerScreen>
    with TickerProviderStateMixin {
  final _submissionId = const Uuid().v4();
  final DateTime _startedAt = DateTime.now();
  int _currentIndex = 0;

  // Câu hỏi và đáp án đã được shuffle (khởi tạo 1 lần trong initData)
  List? _shuffledQuestions;
  bool _dataShuffled = false;

  // questionId -> list of selected optionIds
  final Map<String, List<String>> _answers = {};
  // câu đã được reveal (hiện đáp án đúng/sai)
  final Set<String> _revealed = {};
  // score
  int _correctCount = 0;

  bool _submitting = false;
  Timer? _autoAdvanceTimer;

  // ── Countdown timer ──────────────────────────────────────────────
  int _remainingSeconds = 0;
  Timer? _countdownTimer;
  bool _timerStarted = false;
  List? _cachedQuestions;
  String? _cachedVersionId;

  /// Shuffle câu hỏi và đáp án chỉ 1 lần cho mỗi phiên thi
  List _shuffleData(List rawQuestions) {
    final rng = Random();
    // Deep-copy + shuffle câu hỏi
    final qs = List<Map<String, dynamic>>.from(
      rawQuestions.map((q) => Map<String, dynamic>.from(q as Map)),
    )..shuffle(rng);
    // Shuffle đáp án trong từng câu
    for (final q in qs) {
      final opts = List<Map<String, dynamic>>.from(
        (q['options'] as List).map((o) => Map<String, dynamic>.from(o as Map)),
      )..shuffle(rng);
      q['options'] = opts;
    }
    return qs;
  }

  void _startTimer(int durationMin) {
    if (_timerStarted || durationMin <= 0) return;
    _timerStarted = true;
    _remainingSeconds = durationMin * 60;
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) { t.cancel(); return; }
      if (_remainingSeconds <= 1) {
        t.cancel();
        setState(() => _remainingSeconds = 0);
        // Auto-submit khi hết giờ (offline-first: enqueue ngay)
        if (!_submitting && _cachedQuestions != null && _cachedVersionId != null) {
          _submit(_cachedQuestions!, _cachedVersionId!);
        }
        return;
      }
      setState(() => _remainingSeconds--);
    });
  }

  late final AnimationController _bounceController;
  late final Animation<double> _bounceAnim;
  late final ConfettiController _confettiController;

  @override
  void initState() {
    super.initState();
    _bounceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _bounceAnim = TweenSequence([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.12), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 1.12, end: 1.0), weight: 50),
    ]).animate(CurvedAnimation(parent: _bounceController, curve: Curves.easeInOut));
    _confettiController = ConfettiController(duration: const Duration(milliseconds: 600));
    HardwareKeyboard.instance.addHandler(_handleKey);
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_handleKey);
    _autoAdvanceTimer?.cancel();
    _countdownTimer?.cancel();
    _bounceController.dispose();
    _confettiController.dispose();
    super.dispose();
  }

  bool _handleKey(KeyEvent event) {
    if (event is! KeyDownEvent) return false;
    final questions = _shuffledQuestions;
    if (questions == null) return false;
    final q = questions[_currentIndex] as Map<String, dynamic>;
    final qId = q['id'] as String;
    if (_revealed.contains(qId)) return false;
    final options = q['options'] as List;
    const keys = [
      LogicalKeyboardKey.digit1,
      LogicalKeyboardKey.digit2,
      LogicalKeyboardKey.digit3,
      LogicalKeyboardKey.digit4,
      LogicalKeyboardKey.numpad1,
      LogicalKeyboardKey.numpad2,
      LogicalKeyboardKey.numpad3,
      LogicalKeyboardKey.numpad4,
    ];
    final idx = keys.indexOf(event.logicalKey);
    if (idx < 0) return false;
    final optIdx = idx % 4; // 0-3
    if (optIdx >= options.length) return false;
    final opt = options[optIdx] as Map<String, dynamic>;
    _selectOption(
      qId,
      opt['id'] as String,
      opt['isCorrect'] == true,
      q['questionType'] == 'SINGLE',
      options,
      questions.length,
    );
    return true;
  }

  void _selectOption(String questionId, String optionId, bool isCorrect,
      bool isSingle, List options, int totalQuestions) {
    if (_revealed.contains(questionId)) return; // đã trả lời rồi

    final prev = List<String>.from(_answers[questionId] ?? []);
    if (isSingle) {
      _answers[questionId] = [optionId];
    } else {
      if (prev.contains(optionId)) {
        prev.remove(optionId);
      } else {
        prev.add(optionId);
      }
      _answers[questionId] = prev;
    }

    // Với câu đơn → reveal ngay
    if (isSingle) {
      _revealAndAdvance(questionId, options, totalQuestions);
    }
    setState(() {});
  }

  void _revealAndAdvance(
      String questionId, List options, int totalQuestions) {
    _revealed.add(questionId);
    _bounceController.forward(from: 0);

    // Tính điểm
    final selected = _answers[questionId] ?? [];
    final correctIds =
        options.where((o) => o['isCorrect'] == true).map((o) => o['id'] as String).toSet();
    final selectedSet = selected.toSet();
    if (selectedSet.isNotEmpty &&
        selectedSet.containsAll(correctIds) &&
        correctIds.containsAll(selectedSet)) {
      _correctCount++;
      _confettiController.play();
    }

    setState(() {});

    // Auto-advance sau 1.5s
    _autoAdvanceTimer?.cancel();
    _autoAdvanceTimer = Timer(const Duration(milliseconds: 2000), () {
      if (!mounted) return;
      if (_currentIndex < totalQuestions - 1) {
        setState(() => _currentIndex++);
        _bounceController.reset();
      }
    });
  }

  Future<void> _submit(List questions, String quizVersionId) async {
    setState(() => _submitting = true);
    final payload = {
      'id': _submissionId,
      'quizId': widget.quizId,
      'quizVersionId': quizVersionId,
      'startedAt': _startedAt.toIso8601String(),
      'submittedAt': DateTime.now().toIso8601String(),
      'answers': questions
          .map((q) => {
                'questionId': q['id'],
                'selectedOptionIds': _answers[q['id']] ?? [],
                'answeredAt': DateTime.now().toIso8601String(),
              })
          .toList(),
    };

    // Enqueue vào sync queue — luôn thành công (offline-first)
    await ref.read(syncManagerProvider.notifier).enqueue(payload);

    if (mounted) {
      context.go('/results/$_submissionId', extra: {
        'correctCount': _correctCount,
        'total': questions.length,
      });
    }
    if (mounted) setState(() => _submitting = false);
  }

  /// Hiện dialog thoát/nộp bài sớm
  void _showExitDialog(List questions, String versionId) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A2E),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Thoát bài thi?',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: const Text(
          'Bạn muốn làm gì với bài thi này?',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Tiếp tục thi',
                style: TextStyle(color: Colors.white54)),
          ),
          OutlinedButton.icon(
            onPressed: () {
              Navigator.of(ctx).pop();
              context.pop();
            },
            icon: const Icon(Icons.close_rounded, size: 16),
            label: const Text('Hủy bài thi'),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFFEF4444),
              side: const BorderSide(color: Color(0xFFEF4444)),
            ),
          ),
          FilledButton.icon(
            onPressed: () {
              Navigator.of(ctx).pop();
              _submit(questions, versionId);
            },
            icon: const Icon(Icons.send_rounded, size: 16),
            label: const Text('Nộp bài thi'),
            style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF10B981)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(quizDetailProvider(widget.quizId));
    return detail.when(
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(body: Center(child: Text('$e'))),
      data: (data) {
        final questions = data['questions'] as List;
        // Shuffle 1 lần duy nhất cho phiên này
        if (!_dataShuffled) {
          _shuffledQuestions = _shuffleData(questions);
          _dataShuffled = true;
        }
        final shuffled = _shuffledQuestions!;
        final _versions = data['quiz']['versions'] as List?;
        final versionId =
            (_versions != null && _versions.isNotEmpty) ? (_versions.first['id'] as String? ?? '') : '';
        // Cache để dùng khi auto-submit hết giờ
        _cachedQuestions ??= shuffled;
        _cachedVersionId ??= versionId;
        // Khởi động timer lần đầu (ưu tiên durationMin từ session, fallback từ quiz)
        final durationMin = (data['quiz']['durationMin'] as num?)?.toInt() ?? 0;
        _startTimer(durationMin);
        final q = shuffled[_currentIndex];
        return _QuizQuestionPage(
          question: q,
          questionIndex: _currentIndex,
          totalQuestions: shuffled.length,
          correctCount: _correctCount,
          selected: _answers[q['id']] ?? [],
          isRevealed: _revealed.contains(q['id'] as String),
          onSelect: (optionId, isCorrect) => _selectOption(
            q['id'] as String,
            optionId,
            isCorrect,
            q['questionType'] == 'SINGLE',
            q['options'] as List,
            shuffled.length,
          ),
          onConfirmMulti: () => _revealAndAdvance(
            q['id'] as String,
            q['options'] as List,
            shuffled.length,
          ),
          onPrev: _currentIndex > 0 && !_revealed.contains(q['id'] as String)
              ? () => setState(() => _currentIndex--)
              : null,
          onNext: _revealed.contains(q['id'] as String) &&
                  _currentIndex < shuffled.length - 1
              ? () => setState(() => _currentIndex++)
              : null,
          isLastQuestion: _currentIndex == shuffled.length - 1,
          allAnswered: shuffled
              .every((qn) => _revealed.contains(qn['id'] as String)),
          submitting: _submitting,
          onSubmit: () => _submit(shuffled, versionId),
          onExit: () => _showExitDialog(shuffled, versionId),
          bounceAnim: _bounceAnim,
          remainingSeconds: _remainingSeconds,
          durationSeconds: durationMin * 60,
          confettiController: _confettiController,
        );
      },
    );
  }
}

// ─── Trang câu hỏi ──────────────────────────────────────────────────────────
class _QuizQuestionPage extends StatelessWidget {
  final Map<String, dynamic> question;
  final int questionIndex;
  final int totalQuestions;
  final int correctCount;
  final List<String> selected;
  final bool isRevealed;
  final void Function(String optionId, bool isCorrect) onSelect;
  final VoidCallback onConfirmMulti;
  final VoidCallback? onPrev;
  final VoidCallback? onNext;
  final bool isLastQuestion;
  final bool allAnswered;
  final bool submitting;
  final VoidCallback onSubmit;
  final VoidCallback onExit;
  final Animation<double> bounceAnim;
  final int remainingSeconds;
  final int durationSeconds;
  final ConfettiController confettiController;

  const _QuizQuestionPage({
    required this.question,
    required this.questionIndex,
    required this.totalQuestions,
    required this.correctCount,
    required this.selected,
    required this.isRevealed,
    required this.onSelect,
    required this.onConfirmMulti,
    this.onPrev,
    this.onNext,
    required this.isLastQuestion,
    required this.allAnswered,
    required this.submitting,
    required this.onSubmit,
    required this.onExit,
    required this.bounceAnim,
    required this.remainingSeconds,
    required this.durationSeconds,
    required this.confettiController,
  });

  @override
  Widget build(BuildContext context) {
    final options = question['options'] as List;
    final isSingle = question['questionType'] == 'SINGLE';
    final progress = (questionIndex + 1) / totalQuestions;

    return Stack(
      children: [
        Scaffold(
          backgroundColor: const Color(0xFF1A1A2E),
          body: SafeArea(
            child: Column(
              children: [
                // ── Header ────────────────────────────────────────────────
                _Header(
                  current: questionIndex + 1,
                  total: totalQuestions,
                  correctCount: correctCount,
                  progress: progress,
                  remainingSeconds: remainingSeconds,
                  durationSeconds: durationSeconds,
                  onExit: onExit,
                ),
                // ── Câu hỏi ───────────────────────────────────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                  child: _QuestionCard(
                      content: question['content'] as String,
                      isSingle: isSingle),
                ),
                // ── Feedback banner (khi đã trả lời) ─────────────────────
                if (isRevealed)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: _FeedbackBanner(selected: selected, options: options),
                  ),
                // ── Confirm button (đa lựa chọn) ──────────────────────────
                if (!isSingle && !isRevealed && selected.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: FilledButton.icon(
                      onPressed: onConfirmMulti,
                      icon: const Icon(Icons.check_circle_outline),
                      label: const Text('Xác nhận'),
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF6366F1),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                // ── Options grid — Expanded + LayoutBuilder ───────────────
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        const spacing = 12.0;
                        final cardH = (constraints.maxHeight - spacing) / 2;
                        final cardW = (constraints.maxWidth - spacing) / 2;
                        final ratio = cardW / cardH;
                        return GridView.builder(
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: options.length,
                          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            mainAxisSpacing: spacing,
                            crossAxisSpacing: spacing,
                            childAspectRatio: ratio,
                          ),
                          itemBuilder: (context, i) {
                            final opt = options[i];
                            final optId = opt['id'] as String;
                            final isCorrect = opt['isCorrect'] == true;
                            final isSelected = selected.contains(optId);
                            return ScaleTransition(
                              scale: (isRevealed && isSelected)
                                  ? bounceAnim
                                  : const AlwaysStoppedAnimation(1.0),
                              child: _OptionTile(
                                content: opt['content'] as String,
                                colorBase: _optionColors[i % _optionColors.length],
                                icon: _optionIcons[i % _optionIcons.length],
                                isSelected: isSelected,
                                isRevealed: isRevealed,
                                isCorrect: isCorrect,
                                isSingle: isSingle,
                                optionIndex: i,
                                onTap: isRevealed
                                    ? null
                                    : () => onSelect(optId, isCorrect),
                              ),
                            );
                          },
                        );
                      },
                    ),
                  ),
                ),
                // ── Footer ────────────────────────────────────────────────
                _Footer(
                  onPrev: onPrev,
                  onNext: onNext,
                  isLastQuestion: isLastQuestion,
                  allAnswered: allAnswered,
                  submitting: submitting,
                  onSubmit: onSubmit,
                ),
              ],
            ),
          ),
        ),
        // ── Confetti overlay ─────────────────────────────────────────────
        Align(
          alignment: const Alignment(0, 0.2),
          child: ConfettiWidget(
            confettiController: confettiController,
            blastDirectionality: BlastDirectionality.explosive,
            particleDrag: 0.04,
            emissionFrequency: 0.08,
            numberOfParticles: 24,
            gravity: 0.12,
            shouldLoop: false,
            colors: const [
              Color(0xFF10B981),
              Color(0xFF6366F1),
              Color(0xFFF59E0B),
              Color(0xFFEC4899),
              Colors.white,
              Color(0xFF34D399),
              Color(0xFFFBBF24),
            ],
          ),
        ),
      ],
    );
  }
}

// ─── Header ──────────────────────────────────────────────────────────────────
class _Header extends StatelessWidget {
  final int current;
  final int total;
  final int correctCount;
  final double progress;
  final int remainingSeconds;
  final int durationSeconds;
  final VoidCallback onExit;
  const _Header({
    required this.current,
    required this.total,
    required this.correctCount,
    required this.progress,
    required this.remainingSeconds,
    required this.durationSeconds,
    required this.onExit,
  });

  String _formatTime(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Câu X/Y + nút thoát
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    onPressed: onExit,
                    icon: const Icon(Icons.close_rounded, color: Colors.white54, size: 20),
                    tooltip: 'Hủy / Nộp bài',
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    visualDensity: VisualDensity.compact,
                  ),
                  const SizedBox(width: 6),
                  Text('Câu $current / $total',
                      style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 17,
                          fontWeight: FontWeight.w600)),
                ],
              ),
              // ── Countdown ─────────────────────────────────────────
              if (durationSeconds > 0) Builder(builder: (ctx) {
                final isWarning = remainingSeconds > 0 && remainingSeconds <= 60;
                final isExpired = remainingSeconds == 0;
                final timerColor = isExpired
                    ? const Color(0xFFEF4444)
                    : isWarning
                        ? const Color(0xFFF59E0B)
                        : const Color(0xFF6366F1);
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: timerColor.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: timerColor, width: 1),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        isExpired ? Icons.timer_off_rounded : Icons.timer_rounded,
                        color: timerColor, size: 16,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        isExpired ? 'Hết giờ' : _formatTime(remainingSeconds),
                        style: TextStyle(
                          color: timerColor,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                );
              }),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20),
                  border:
                      Border.all(color: const Color(0xFF10B981), width: 1),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.star_rounded,
                        color: Color(0xFF10B981), size: 16),
                    const SizedBox(width: 4),
                    Text('$correctCount đúng',
                        style: const TextStyle(
                            color: Color(0xFF10B981),
                            fontSize: 16,
                            fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: Colors.white12,
              valueColor:
                  const AlwaysStoppedAnimation<Color>(Color(0xFF6366F1)),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Question card ────────────────────────────────────────────────────────────
class _QuestionCard extends StatelessWidget {
  final String content;
  final bool isSingle;
  const _QuestionCard({required this.content, required this.isSingle});

  @override
  Widget build(BuildContext context) {
    // Font câu hỏi = shortestSide × 0.0455 (giảm 30% so với 0.065)
    final fontSize = (MediaQuery.of(context).size.shortestSide * 0.0455)
        .clamp(13.0, 36.0);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF16213E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        children: [
          if (!isSingle)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withOpacity(0.2),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text('Chọn nhiều đáp án',
                  style:
                      TextStyle(color: Color(0xFFF59E0B), fontSize: 14)),
            ),
          Text(content,
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: const Color(0xFFFDE68A),
                  fontSize: fontSize,
                  fontWeight: FontWeight.w700,
                  height: 1.45)),
        ],
      ),
    );
  }
}

// ─── Option tile ─────────────────────────────────────────────────────────────
class _OptionTile extends StatelessWidget {
  final String content;
  final Color colorBase;
  final IconData icon;
  final bool isSelected;
  final bool isRevealed;
  final bool isCorrect;
  final bool isSingle;
  final int optionIndex;
  final VoidCallback? onTap;

  const _OptionTile({
    required this.content,
    required this.colorBase,
    required this.icon,
    required this.isSelected,
    required this.isRevealed,
    required this.isCorrect,
    required this.isSingle,
    required this.optionIndex,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    // ── Xác định màu sau khi reveal ──────────────────────────────────
    Color bgColor = colorBase;
    Color borderColor = colorBase;
    Color contentColor = Colors.white;
    Widget? badge;

    // Dấu tích khi chưa reveal (chỉ áp dụng câu đa lựa chọn)
    Widget? preSelectBadge;
    if (!isRevealed && !isSingle && isSelected) {
      preSelectBadge = Container(
        width: 22,
        height: 22,
        decoration: const BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
        ),
        child: Icon(Icons.check_rounded, color: colorBase, size: 15),
      );
    }

    if (isRevealed) {
      if (isCorrect) {
        bgColor = const Color(0xFF10B981);
        borderColor = const Color(0xFF10B981);
        badge = const Icon(Icons.check_circle_rounded,
            color: Colors.white, size: 20);
      } else if (isSelected && !isCorrect) {
        bgColor = const Color(0xFFEF4444);
        borderColor = const Color(0xFFEF4444);
        badge = const Icon(Icons.cancel_rounded,
            color: Colors.white, size: 20);
      } else {
        // chưa chọn + sai
        bgColor = Colors.white10;
        borderColor = Colors.white24;
        contentColor = Colors.white38;
      }
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor, width: 2),
        boxShadow: isSelected && !isRevealed
            ? [
                BoxShadow(
                    color: colorBase.withOpacity(0.5),
                    blurRadius: 10,
                    spreadRadius: 1),
              ]
            : [],
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: LayoutBuilder(
          builder: (context, constraints) {
            // Phần diện tích dành cho text sau khi trừ icon row + padding
            const iconRowH = 26.0; // icon 20 + SizedBox 6
            const padAll = 10.0;
            final textAreaH = (constraints.maxHeight - iconRowH - padAll * 2).clamp(20.0, 9999.0);
            final textAreaW = (constraints.maxWidth - padAll * 2).clamp(20.0, 9999.0);
            // Font lấy 90% cạnh nhỏ hơn của vùng text, clamp hợp lý
            final fontSize = (textAreaH < textAreaW ? textAreaH : textAreaW) * 0.9 / 2.8;
            final clampedFont = fontSize.clamp(11.0, 38.0);
            return Padding(
              padding: const EdgeInsets.all(padAll),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Icon (trái) + phím tắt (giữa) + badge check/✗ (phải)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Icon(icon, color: contentColor.withOpacity(0.8), size: 20),
                      // Shortcut key hint — ẩn khi đã reveal
                      if (!isRevealed)
                        Container(
                          width: 20,
                          height: 20,
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.18),
                            borderRadius: BorderRadius.circular(5),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            '${optionIndex + 1}',
                            style: TextStyle(
                              color: contentColor.withOpacity(0.85),
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        )
                      else if (badge != null) badge!
                      else if (preSelectBadge != null) preSelectBadge!
                      else const SizedBox(width: 20),
                    ],
                  ),
                  const SizedBox(height: 6),
                  // FittedBox đảm bảo text không bao giờ tràn ra ngoài ô
                  Expanded(
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.center,
                      child: SizedBox(
                        width: textAreaW,
                        child: Text(
                          content,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: contentColor,
                            fontSize: clampedFont,
                            fontWeight: FontWeight.w700,
                            height: 1.35,
                          ),
                          softWrap: true,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

// ─── Feedback banner ──────────────────────────────────────────────────────────
class _FeedbackBanner extends StatelessWidget {
  final List<String> selected;
  final List options;
  const _FeedbackBanner({required this.selected, required this.options});

  @override
  Widget build(BuildContext context) {
    final correctIds = options
        .where((o) => o['isCorrect'] == true)
        .map((o) => o['id'] as String)
        .toSet();
    final selectedSet = selected.toSet();
    final isRight = selectedSet.isNotEmpty &&
        selectedSet.containsAll(correctIds) &&
        correctIds.containsAll(selectedSet);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isRight
            ? const Color(0xFF10B981).withOpacity(0.15)
            : const Color(0xFFEF4444).withOpacity(0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isRight
              ? const Color(0xFF10B981)
              : const Color(0xFFEF4444),
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          Icon(
            isRight ? Icons.emoji_events_rounded : Icons.lightbulb_outline_rounded,
            color: isRight
                ? const Color(0xFF10B981)
                : const Color(0xFFF59E0B),
            size: 24,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              isRight
                  ? 'Chính xác! Tuyệt vời 🎉'
                  : 'Chưa đúng. Đáp án đúng đã được tô xanh.',
              style: TextStyle(
                color:
                    isRight ? const Color(0xFF10B981) : const Color(0xFFFFFFFF),
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Footer navigation ────────────────────────────────────────────────────────
class _Footer extends StatelessWidget {
  final VoidCallback? onPrev;
  final VoidCallback? onNext;
  final bool isLastQuestion;
  final bool allAnswered;
  final bool submitting;
  final VoidCallback onSubmit;

  const _Footer({
    this.onPrev,
    this.onNext,
    required this.isLastQuestion,
    required this.allAnswered,
    required this.submitting,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      decoration: const BoxDecoration(
        color: Color(0xFF16213E),
        border: Border(top: BorderSide(color: Colors.white12)),
      ),
      child: Row(
        children: [
          if (onPrev != null) ...[
            Expanded(
              child: OutlinedButton.icon(
                onPressed: onPrev,
                icon: const Icon(Icons.arrow_back_rounded, size: 18),
                label: const Text('Trước'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white70,
                  side: const BorderSide(color: Colors.white24),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
            const SizedBox(width: 12),
          ],
          if (onNext != null)
            Expanded(
              child: FilledButton.icon(
                onPressed: onNext,
                icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                label: const Text('Câu tiếp'),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF6366F1),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          if (isLastQuestion && allAnswered)
            Expanded(
              child: FilledButton.icon(
                onPressed: submitting ? null : onSubmit,
                icon: submitting
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.send_rounded, size: 18),
                label: Text(submitting ? 'Đang nộp...' : 'Nộp bài'),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

