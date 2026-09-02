import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../auth/auth_provider.dart';

// ─── Constants ─────────────────────────────────────────────────────────────

const _wsUrl = String.fromEnvironment('API_URL', defaultValue: 'http://localhost:13010/api');

String get _wsBase => _wsUrl.replaceAll('/api', '');

// ─── Data models ───────────────────────────────────────────────────────────

class ArenaTeam {
  final String id;
  final String name;
  final String color;
  final int score;
  final int? rank;
  const ArenaTeam({required this.id, required this.name, required this.color, required this.score, this.rank});

  factory ArenaTeam.fromJson(Map<String, dynamic> json) => ArenaTeam(
        id: json['id'] as String,
        name: json['name'] as String,
        color: json['color'] as String,
        score: (json['score'] as num?)?.toInt() ?? 0,
        rank: json['rank'] as int?,
      );

  ArenaTeam copyWith({int? score, int? rank}) => ArenaTeam(id: id, name: name, color: color, score: score ?? this.score, rank: rank ?? this.rank);
}

class ArenaQuestionOption {
  final String id;
  final String content;
  const ArenaQuestionOption({required this.id, required this.content});

  factory ArenaQuestionOption.fromJson(Map<String, dynamic> json) =>
      ArenaQuestionOption(id: json['id'] as String, content: json['content'] as String);
}

class ArenaQuestion {
  final String roundId;
  final int order;
  final String questionId;
  final String content;
  final String questionType;
  final List<ArenaQuestionOption> options;
  final int autoAdvanceSec;
  final String hostMode;

  const ArenaQuestion({
    required this.roundId, required this.order, required this.questionId,
    required this.content, required this.questionType, required this.options,
    required this.autoAdvanceSec, required this.hostMode,
  });

  factory ArenaQuestion.fromJson(Map<String, dynamic> json) {
    final q = json['question'] as Map<String, dynamic>;
    return ArenaQuestion(
      roundId: json['roundId'] as String,
      order: (json['order'] as num).toInt(),
      questionId: q['id'] as String,
      content: q['content'] as String,
      questionType: q['questionType'] as String,
      options: (q['options'] as List).map((e) => ArenaQuestionOption.fromJson(e as Map<String, dynamic>)).toList(),
      autoAdvanceSec: (json['autoAdvanceSec'] as num?)?.toInt() ?? 15,
      hostMode: json['hostMode'] as String? ?? 'MANUAL',
    );
  }
}

class RevealData {
  final String roundId;
  final List<String> correctOptionIds;
  final String? explanation;
  final List<ArenaTeam> leaderboard;

  const RevealData({required this.roundId, required this.correctOptionIds, this.explanation, required this.leaderboard});

  factory RevealData.fromJson(Map<String, dynamic> json) => RevealData(
        roundId: json['roundId'] as String,
        correctOptionIds: List<String>.from(json['correctOptionIds'] as List),
        explanation: json['explanation'] as String?,
        leaderboard: (json['leaderboard'] as List).map((e) => ArenaTeam.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

// ─── State ─────────────────────────────────────────────────────────────────

enum ArenaScreenView { join, lobby, playing, revealed, result }

class ArenaState {
  final ArenaScreenView view;
  final String? sessionId;
  final String? joinCode;
  final String? sessionName;
  final String? quizTitle;
  final String? teamId;
  final String? teamName;
  final String? teamColor;
  final List<ArenaTeam> teams;
  final ArenaQuestion? currentQuestion;
  final List<String> buzzedTeamNames; // teams who already answered
  final RevealData? revealData;
  final List<String> selectedOptionIds;
  final bool hasAnswered;
  final List<ArenaTeam> finalRanking;
  final int totalRounds;
  final String? errorMessage;

  const ArenaState({
    this.view = ArenaScreenView.join,
    this.sessionId,
    this.joinCode,
    this.sessionName,
    this.quizTitle,
    this.teamId,
    this.teamName,
    this.teamColor,
    this.teams = const [],
    this.currentQuestion,
    this.buzzedTeamNames = const [],
    this.revealData,
    this.selectedOptionIds = const [],
    this.hasAnswered = false,
    this.finalRanking = const [],
    this.totalRounds = 0,
    this.errorMessage,
  });

  ArenaState copyWith({
    ArenaScreenView? view, String? sessionId, String? joinCode, String? sessionName,
    String? quizTitle, String? teamId, String? teamName, String? teamColor,
    List<ArenaTeam>? teams, ArenaQuestion? currentQuestion,
    List<String>? buzzedTeamNames, RevealData? revealData,
    List<String>? selectedOptionIds, bool? hasAnswered,
    List<ArenaTeam>? finalRanking, int? totalRounds, String? errorMessage,
  }) => ArenaState(
        view: view ?? this.view,
        sessionId: sessionId ?? this.sessionId,
        joinCode: joinCode ?? this.joinCode,
        sessionName: sessionName ?? this.sessionName,
        quizTitle: quizTitle ?? this.quizTitle,
        teamId: teamId ?? this.teamId,
        teamName: teamName ?? this.teamName,
        teamColor: teamColor ?? this.teamColor,
        teams: teams ?? this.teams,
        currentQuestion: currentQuestion ?? this.currentQuestion,
        buzzedTeamNames: buzzedTeamNames ?? this.buzzedTeamNames,
        revealData: revealData ?? this.revealData,
        selectedOptionIds: selectedOptionIds ?? this.selectedOptionIds,
        hasAnswered: hasAnswered ?? this.hasAnswered,
        finalRanking: finalRanking ?? this.finalRanking,
        totalRounds: totalRounds ?? this.totalRounds,
        errorMessage: errorMessage,
      );
}

// ─── Notifier ──────────────────────────────────────────────────────────────

class ArenaNotifier extends StateNotifier<ArenaState> {
  final Ref _ref;
  io.Socket? _socket;

  ArenaNotifier(this._ref) : super(const ArenaState());

  void clearError() => state = state.copyWith();

  // Called after GET /arena/join/:code succeeds — connect socket
  void connectToSession({
    required String sessionId,
    required String joinCode,
    required String sessionName,
    required String quizTitle,
    required int totalRounds,
    required String teamId,
    required String teamName,
    required String teamColor,
    required List<ArenaTeam> existingTeams,
  }) {
    state = state.copyWith(
      sessionId: sessionId, joinCode: joinCode, sessionName: sessionName,
      quizTitle: quizTitle, totalRounds: totalRounds,
      teamId: teamId, teamName: teamName, teamColor: teamColor,
      teams: existingTeams, view: ArenaScreenView.lobby,
    );
    _initSocket(sessionId);
  }

  void _initSocket(String sessionId) {
    final token = _ref.read(authStateProvider).token;
    _socket = io.io(
      _wsBase,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token ?? ''})
          .build(),
    );

    _socket!.onConnect((_) {
      _socket!.emit('arena.join', {
        'joinCode': state.joinCode,
        'teamName': state.teamName,
      });
    });

    _socket!.on('arena.team_joined', (data) {
      final team = ArenaTeam.fromJson(data['team'] as Map<String, dynamic>);
      final updated = [...state.teams.where((t) => t.id != team.id), team];
      state = state.copyWith(teams: updated);
    });

    _socket!.on('arena.started', (_) {
      // wait for arena.question event
    });

    // Receive own teamId after socket join is confirmed by server
    _socket!.on('arena.joined_you', (data) {
      state = state.copyWith(
        teamId: data['teamId'] as String,
        teamColor: data['teamColor'] as String,
      );
    });

    _socket!.on('arena.question', (data) {
      final q = ArenaQuestion.fromJson(data as Map<String, dynamic>);
      state = state.copyWith(
        view: ArenaScreenView.playing,
        currentQuestion: q,
        buzzedTeamNames: [],
        revealData: null,
        selectedOptionIds: [],
        hasAnswered: false,
      );
    });

    _socket!.on('arena.buzz_in', (data) {
      final name = data['teamName'] as String;
      if (!state.buzzedTeamNames.contains(name)) {
        state = state.copyWith(buzzedTeamNames: [...state.buzzedTeamNames, name]);
      }
    });

    _socket!.on('arena.revealed', (data) {
      final reveal = RevealData.fromJson(data as Map<String, dynamic>);
      state = state.copyWith(view: ArenaScreenView.revealed, revealData: reveal, teams: reveal.leaderboard);
    });

    _socket!.on('arena.leaderboard', (data) {
      final teams = (data['teams'] as List).map((e) => ArenaTeam.fromJson(e as Map<String, dynamic>)).toList();
      state = state.copyWith(teams: teams);
    });

    _socket!.on('arena.ended', (data) {
      final ranking = (data['ranking'] as List).map((e) => ArenaTeam.fromJson(e as Map<String, dynamic>)).toList();
      state = state.copyWith(view: ArenaScreenView.result, finalRanking: ranking);
    });
  }

  void submitAnswer(List<String> selectedOptionIds) {
    final q = state.currentQuestion;
    final teamId = state.teamId;
    if (q == null || teamId == null || teamId.isEmpty || state.hasAnswered) return;
    state = state.copyWith(selectedOptionIds: selectedOptionIds, hasAnswered: true);
    _socket?.emit('arena.answer', {
      'arenaRoundId': q.roundId,
      'teamId': teamId,
      'selectedOptionIds': selectedOptionIds,
    });
  }

  void reset() {
    _socket?.disconnect();
    _socket = null;
    state = const ArenaState();
  }

  @override
  void dispose() {
    _socket?.disconnect();
    super.dispose();
  }
}

final arenaProvider = StateNotifierProvider<ArenaNotifier, ArenaState>(
  (ref) => ArenaNotifier(ref),
);
