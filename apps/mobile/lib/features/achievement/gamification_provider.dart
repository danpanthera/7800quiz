import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';

// ── DTOs ─────────────────────────────────────────────────────────────────────

class UserProgressData {
  final int xp;
  final int level;
  final String levelName;
  final String color;
  final int xpToNext;
  final int xpInCurrentLevel;
  final int percentToNext;
  final int currentStreak;
  final int maxStreak;
  final int totalSubmissions;
  final int totalArenaWins;
  final int rank;
  final List<BadgeData> badges;

  const UserProgressData({
    required this.xp,
    required this.level,
    required this.levelName,
    required this.color,
    required this.xpToNext,
    required this.xpInCurrentLevel,
    required this.percentToNext,
    required this.currentStreak,
    required this.maxStreak,
    required this.totalSubmissions,
    required this.totalArenaWins,
    required this.rank,
    required this.badges,
  });

  factory UserProgressData.fromJson(Map<String, dynamic> j) => UserProgressData(
        xp: j['xp'] as int,
        level: j['level'] as int,
        levelName: j['levelName'] as String,
        color: j['color'] as String,
        xpToNext: j['xpToNext'] as int,
        xpInCurrentLevel: j['xpInCurrentLevel'] as int,
        percentToNext: j['percentToNext'] as int,
        currentStreak: j['currentStreak'] as int,
        maxStreak: j['maxStreak'] as int,
        totalSubmissions: j['totalSubmissions'] as int,
        totalArenaWins: j['totalArenaWins'] as int,
        rank: j['rank'] as int,
        badges: (j['badges'] as List).map((b) => BadgeData.fromJson(b as Map<String, dynamic>)).toList(),
      );
}

class BadgeData {
  final String code;
  final String name;
  final String iconSlug;
  final String category;
  final DateTime awardedAt;

  const BadgeData({
    required this.code,
    required this.name,
    required this.iconSlug,
    required this.category,
    required this.awardedAt,
  });

  factory BadgeData.fromJson(Map<String, dynamic> j) => BadgeData(
        code: j['code'] as String,
        name: j['name'] as String,
        iconSlug: j['iconSlug'] as String,
        category: j['category'] as String,
        awardedAt: DateTime.parse(j['awardedAt'] as String),
      );
}

// ── Gamification Event (levelUp notification từ sync) ─────────────────────────

/// Được set bởi SyncManager khi API trả về levelUp=true.
/// ResultScreen lắng nghe và hiển thị LevelUpDialog.
final gamificationEventProvider = StateProvider<Map<String, dynamic>?>((ref) => null);

// ── Provider ──────────────────────────────────────────────────────────────────

final userProgressProvider = FutureProvider<UserProgressData>((ref) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get('/me/progress');
  return UserProgressData.fromJson(res.data as Map<String, dynamic>);
});
