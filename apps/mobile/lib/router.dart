import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/change_password_screen.dart';
import 'features/quiz_list/quiz_list_screen.dart';
import 'features/quiz_detail/quiz_detail_screen.dart';
import 'features/quiz_player/quiz_player_screen.dart';
import 'features/result/result_screen.dart';
import 'features/auth/auth_provider.dart';
import 'features/arena/arena_join_screen.dart';
import 'features/arena/arena_lobby_screen.dart';
import 'features/arena/arena_player_screen.dart';
import 'features/arena/arena_result_screen.dart';
import 'features/achievement/achievement_screen.dart';
import 'features/achievement/leaderboard_screen.dart';

/// Slide + fade transition — dùng cho mọi route chính
Page<void> _slidePage(GoRouterState state, Widget child) {
  return CustomTransitionPage<void>(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 320),
    reverseTransitionDuration: const Duration(milliseconds: 260),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final slide = Tween<Offset>(
        begin: const Offset(1.0, 0.0),
        end: Offset.zero,
      ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic));

      final fade = Tween<double>(begin: 0.0, end: 1.0)
          .animate(CurvedAnimation(parent: animation, curve: Curves.easeOut));

      final secondarySlide = Tween<Offset>(
        begin: Offset.zero,
        end: const Offset(-0.25, 0.0),
      ).animate(CurvedAnimation(parent: secondaryAnimation, curve: Curves.easeInCubic));

      return SlideTransition(
        position: secondarySlide,
        child: FadeTransition(
          opacity: fade,
          child: SlideTransition(position: slide, child: child),
        ),
      );
    },
  );
}

/// Fade-only transition — dùng cho login / root screens
Page<void> _fadePage(GoRouterState state, Widget child) {
  return CustomTransitionPage<void>(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 400),
    transitionsBuilder: (context, animation, _, child) {
      return FadeTransition(
        opacity: CurvedAnimation(parent: animation, curve: Curves.easeInOut),
        child: child,
      );
    },
  );
}

/// Scale + fade — dùng cho Arena screens (cảm giác "sân đấu")
Page<void> _arenaPage(GoRouterState state, Widget child) {
  return CustomTransitionPage<void>(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 380),
    transitionsBuilder: (context, animation, _, child) {
      final scale = Tween<double>(begin: 0.92, end: 1.0)
          .animate(CurvedAnimation(parent: animation, curve: Curves.easeOutBack));
      final fade = Tween<double>(begin: 0.0, end: 1.0)
          .animate(CurvedAnimation(parent: animation, curve: Curves.easeOut));
      return FadeTransition(
        opacity: fade,
        child: ScaleTransition(scale: scale, child: child),
      );
    },
  );
}

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = AuthChangeNotifier();
  ref.listen<AuthState>(authStateProvider, (_, __) => notifier.notify());

  return GoRouter(
    initialLocation: '/quizzes',
    refreshListenable: notifier,
    redirect: (context, state) {
      final authState = ref.read(authStateProvider);
      final isLoggedIn = authState.token != null;
      final loc = state.matchedLocation;

      if (!isLoggedIn && loc != '/login') return '/login';
      if (isLoggedIn && loc == '/login') {
        return authState.mustChangePassword ? '/change-password' : '/quizzes';
      }
      if (isLoggedIn && authState.mustChangePassword && loc != '/change-password') {
        return '/change-password';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        pageBuilder: (_, state) => _fadePage(state, const LoginScreen()),
      ),
      GoRoute(
        path: '/change-password',
        pageBuilder: (_, state) => _slidePage(state, const ChangePasswordScreen()),
      ),
      GoRoute(
        path: '/quizzes',
        pageBuilder: (_, state) => _fadePage(state, const QuizListScreen()),
      ),
      GoRoute(
        path: '/quizzes/:id',
        pageBuilder: (_, state) => _slidePage(
          state,
          QuizDetailScreen(quizId: state.pathParameters['id']!),
        ),
      ),
      GoRoute(
        path: '/quizzes/:id/play',
        pageBuilder: (_, state) => _slidePage(
          state,
          QuizPlayerScreen(quizId: state.pathParameters['id']!),
        ),
      ),
      GoRoute(
        path: '/results/:submissionId',
        pageBuilder: (_, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return _arenaPage(
            state,
            ResultScreen(
              submissionId: state.pathParameters['submissionId']!,
              localCorrect: extra?['correctCount'] as int?,
              localTotal: extra?['total'] as int?,
            ),
          );
        },
      ),
      GoRoute(
        path: '/arena/join',
        pageBuilder: (_, state) => _arenaPage(state, const ArenaJoinScreen()),
      ),
      GoRoute(
        path: '/arena/lobby',
        pageBuilder: (_, state) => _arenaPage(state, const ArenaLobbyScreen()),
      ),
      GoRoute(
        path: '/arena/play',
        pageBuilder: (_, state) => _arenaPage(state, const ArenaPlayerScreen()),
      ),
      GoRoute(
        path: '/arena/result',
        pageBuilder: (_, state) => _arenaPage(state, const ArenaResultScreen()),
      ),
      GoRoute(
        path: '/achievement',
        pageBuilder: (_, state) => _slidePage(state, const AchievementScreen()),
      ),
      GoRoute(
        path: '/leaderboard',
        pageBuilder: (_, state) => _slidePage(state, const LeaderboardScreen()),
      ),
    ],
  );
});
