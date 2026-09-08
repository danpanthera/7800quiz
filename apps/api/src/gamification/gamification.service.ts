import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XpSource, BadgeCategory } from '@prisma/client';

type ConditionType =
  | 'submission_count'
  | 'pass_count'
  | 'perfect_score'
  | 'streak_days'
  | 'arena_win_count'
  | 'level_reached'
  | 'consecutive_pass';

interface BadgeCondition {
  type: ConditionType;
  value: number;
}

@Injectable()
export class GamificationService {
  constructor(private prisma: PrismaService) {}

  // ─── awardXp ─────────────────────────────────────────────────────────────

  async awardXp(
    userId: string,
    amount: number,
    source: XpSource,
    referenceId?: string,
    note?: string,
  ): Promise<{
    levelUp: boolean;
    newLevel: number;
    newBadges: { code: string; name: string; iconSlug: string }[];
  }> {
    // Cập nhật (hoặc tạo mới) UserProgress
    let progress = await this.prisma.userProgress.upsert({
      where: { userId },
      update: { xp: { increment: amount } },
      create: { userId, xp: amount },
    });

    // Ghi lại XpTransaction
    await this.prisma.xpTransaction.create({
      data: {
        userProgressId: progress.id,
        userId,
        amount,
        source,
        referenceId,
        note,
      },
    });

    // Lấy lại progress vừa cập nhật
    progress = await this.prisma.userProgress.findUniqueOrThrow({
      where: { userId },
    });

    // Tính lại cấp độ (dựa theo dữ liệu trong DB)
    const levelDef = await this.prisma.levelDefinition.findFirst({
      where: { minXp: { lte: progress.xp } },
      orderBy: { minXp: 'desc' },
    });
    const newLevel = levelDef?.level ?? 1;
    const oldLevel = progress.level;
    const levelUp = newLevel > oldLevel;

    if (levelUp) {
      await this.prisma.userProgress.update({
        where: { userId },
        data: { level: newLevel },
      });
    }

    // Kiểm tra điều kiện huy hiệu
    const newBadges = await this.checkAndAwardBadges(userId, progress.id);

    return { levelUp, newLevel, newBadges };
  }

  // ─── updateActivity (streak logic) ───────────────────────────────────────

  async updateActivity(userId: string): Promise<void> {
    const progress = await this.prisma.userProgress.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    const nowUtc7 = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const today = new Date(nowUtc7.toISOString().slice(0, 10)); // yyyy-mm-dd UTC+7

    const lastDate = progress.lastActivityDate;

    let newStreak = progress.currentStreak;

    if (!lastDate) {
      newStreak = 1;
    } else {
      const lastUtc7 = new Date(
        new Date(lastDate).getTime() + 7 * 60 * 60 * 1000,
      );
      const lastDay = new Date(lastUtc7.toISOString().slice(0, 10));
      const diffDays = Math.round(
        (today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 0) {
        // Cùng ngày, không đổi
        return;
      } else if (diffDays === 1) {
        newStreak = progress.currentStreak + 1;
      } else {
        newStreak = 1;
      }
    }

    const newMaxStreak = Math.max(newStreak, progress.maxStreak);

    await this.prisma.userProgress.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        maxStreak: newMaxStreak,
        lastActivityDate: today,
      },
    });

    // Thưởng XP cho các mốc chuỗi ngày (streak)
    if (newStreak === 7 || newStreak === 30) {
      const bonusXp = newStreak === 7 ? 100 : 500;
      await this.awardXp(
        userId,
        bonusXp,
        XpSource.STREAK_BONUS,
        undefined,
        `Streak ${newStreak} ngày`,
      );
    }
  }

  // ─── incrementStats ───────────────────────────────────────────────────────

  async incrementSubmissionStats(
    userId: string,
    isPassed: boolean,
  ): Promise<void> {
    await this.prisma.userProgress.upsert({
      where: { userId },
      update: {
        totalSubmissions: { increment: 1 },
        ...(isPassed ? { totalPassed: { increment: 1 } } : {}),
      },
      create: { userId, totalSubmissions: 1, totalPassed: isPassed ? 1 : 0 },
    });
  }

  async incrementArenaWins(userId: string): Promise<void> {
    await this.prisma.userProgress.upsert({
      where: { userId },
      update: { totalArenaWins: { increment: 1 } },
      create: { userId, totalArenaWins: 1 },
    });
  }

  // ─── checkAndAwardBadges ─────────────────────────────────────────────────

  async checkAndAwardBadges(
    userId: string,
    userProgressId: string,
  ): Promise<{ code: string; name: string; iconSlug: string }[]> {
    const progress = await this.prisma.userProgress.findUniqueOrThrow({
      where: { userId },
      include: { userBadges: true },
    });

    const alreadyHas = new Set(
      progress.userBadges.map((ub) => ub.badgeDefinitionId),
    );
    const allBadges = await this.prisma.badgeDefinition.findMany();

    const newBadges: { code: string; name: string; iconSlug: string }[] = [];

    for (const badge of allBadges) {
      if (alreadyHas.has(badge.id)) continue;

      const condition = badge.conditionJson as unknown as BadgeCondition;
      const met = await this.evaluateCondition(condition, userId, progress);

      if (met) {
        await this.prisma.userBadge.create({
          data: { userProgressId, userId, badgeDefinitionId: badge.id },
        });

        // Cộng thêm xpBonus nếu huy hiệu có thưởng XP
        if (badge.xpBonus > 0) {
          await this.prisma.userProgress.update({
            where: { userId },
            data: { xp: { increment: badge.xpBonus } },
          });
          await this.prisma.xpTransaction.create({
            data: {
              userProgressId,
              userId,
              amount: badge.xpBonus,
              source: XpSource.BADGE_BONUS,
              referenceId: badge.id,
              note: `Badge bonus: ${badge.name}`,
            },
          });
        }

        newBadges.push({
          code: badge.code,
          name: badge.name,
          iconSlug: badge.iconSlug,
        });
      }
    }

    return newBadges;
  }

  private async evaluateCondition(
    condition: BadgeCondition,
    userId: string,
    progress: {
      totalSubmissions: number;
      totalPassed: number;
      currentStreak: number;
      totalArenaWins: number;
      level: number;
    },
  ): Promise<boolean> {
    switch (condition.type) {
      case 'submission_count':
        return progress.totalSubmissions >= condition.value;

      case 'pass_count':
        return progress.totalPassed >= condition.value;

      case 'perfect_score': {
        const perfectCount = await this.prisma.submission.count({
          where: { userId, score: 100 },
        });
        return perfectCount >= condition.value;
      }

      case 'streak_days':
        return progress.currentStreak >= condition.value;

      case 'arena_win_count':
        return progress.totalArenaWins >= condition.value;

      case 'level_reached':
        return progress.level >= condition.value;

      case 'consecutive_pass': {
        const recent = await this.prisma.submission.findMany({
          where: { userId, status: 'GRADED' },
          orderBy: { submittedAt: 'desc' },
          take: condition.value,
          select: { isPassed: true },
        });
        return (
          recent.length >= condition.value &&
          recent.every((s) => s.isPassed === true)
        );
      }

      default:
        return false;
    }
  }

  // ─── getProgress ─────────────────────────────────────────────────────────

  async getProgress(userId: string) {
    const progress = await this.prisma.userProgress.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: {
        userBadges: {
          include: { badgeDefinition: true },
          orderBy: { awardedAt: 'desc' },
        },
      },
    });

    const currentLevelDef = await this.prisma.levelDefinition.findFirst({
      where: { level: progress.level },
    });
    const nextLevelDef = await this.prisma.levelDefinition.findFirst({
      where: { level: progress.level + 1 },
    });

    const xpInCurrentLevel = progress.xp - (currentLevelDef?.minXp ?? 0);
    const xpToNext = nextLevelDef
      ? nextLevelDef.minXp - (currentLevelDef?.minXp ?? 0)
      : 0;
    const percentToNext =
      xpToNext > 0
        ? Math.min(100, Math.round((xpInCurrentLevel / xpToNext) * 100))
        : 100;

    // Global rank
    const rank = await this.prisma.userProgress.count({
      where: { xp: { gt: progress.xp } },
    });

    return {
      xp: progress.xp,
      level: progress.level,
      levelName: currentLevelDef?.name ?? 'Tân binh',
      color: currentLevelDef?.color ?? '#9E9E9E',
      xpToNext: nextLevelDef?.minXp ? nextLevelDef.minXp - progress.xp : 0,
      xpInCurrentLevel,
      percentToNext,
      currentStreak: progress.currentStreak,
      maxStreak: progress.maxStreak,
      totalSubmissions: progress.totalSubmissions,
      totalArenaWins: progress.totalArenaWins,
      rank: rank + 1,
      badges: progress.userBadges.map((ub) => ({
        code: ub.badgeDefinition.code,
        name: ub.badgeDefinition.name,
        iconSlug: ub.badgeDefinition.iconSlug,
        category: ub.badgeDefinition.category,
        awardedAt: ub.awardedAt,
      })),
    };
  }

  async getBadges(userId: string) {
    return this.prisma.userBadge.findMany({
      where: { userId },
      include: { badgeDefinition: true },
      orderBy: { awardedAt: 'desc' },
    });
  }

  async getXpHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.xpTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.xpTransaction.count({ where: { userId } }),
    ]);
    return { items, total, page, limit };
  }

  // ─── Admin: Leaderboard ───────────────────────────────────────────────────

  async getLeaderboard(
    period: 'all' | 'month' | 'week' = 'all',
    departmentId?: string,
  ) {
    if (period === 'all' && !departmentId) {
      // Dùng UserProgress trực tiếp
      const rows = await this.prisma.userProgress.findMany({
        orderBy: { xp: 'desc' },
        take: 100,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              departmentId: true,
              department: { select: { name: true } },
            },
          },
        },
      });
      return rows
        .filter((r) => !departmentId || r.user.departmentId === departmentId)
        .map((r, i) => ({
          rank: i + 1,
          userId: r.userId,
          fullName: r.user.fullName,
          department: r.user.department?.name,
          xp: r.xp,
          level: r.level,
        }));
    }

    // Tính XP theo khoảng thời gian
    const now = new Date();
    let since: Date;
    if (period === 'month') {
      since = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      const day = now.getDay();
      since = new Date(now);
      since.setDate(now.getDate() - day);
      since.setHours(0, 0, 0, 0);
    }

    const txGroups = await this.prisma.xpTransaction.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: since } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 100,
    });

    const userIds = txGroups.map((g) => g.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        fullName: true,
        departmentId: true,
        department: { select: { name: true } },
      },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return txGroups
      .filter(
        (g) =>
          !departmentId || userMap.get(g.userId)?.departmentId === departmentId,
      )
      .map((g, i) => {
        const u = userMap.get(g.userId);
        return {
          rank: i + 1,
          userId: g.userId,
          fullName: u?.fullName ?? '',
          department: u?.department?.name,
          xp: g._sum.amount ?? 0,
        };
      });
  }

  async getBadgeStats() {
    const badges = await this.prisma.badgeDefinition.findMany({
      include: { _count: { select: { userBadges: true } } },
      orderBy: { category: 'asc' },
    });
    return badges.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      category: b.category,
      iconSlug: b.iconSlug,
      xpBonus: b.xpBonus,
      awardedCount: b._count.userBadges,
    }));
  }

  // ─── Admin: CRUD LevelDefinition ─────────────────────────────────────────

  getLevels() {
    return this.prisma.levelDefinition.findMany({ orderBy: { level: 'asc' } });
  }

  createLevel(data: {
    level: number;
    name: string;
    minXp: number;
    color: string;
    iconSlug?: string;
  }) {
    return this.prisma.levelDefinition.create({ data });
  }

  updateLevel(
    id: string,
    data: Partial<{
      name: string;
      minXp: number;
      color: string;
      iconSlug: string;
    }>,
  ) {
    return this.prisma.levelDefinition.update({ where: { id }, data });
  }

  // ─── recomputeUserProgress ───────────────────────────────────────────────
  // Gọi sau khi xóa bài thi/vết tích thi của 1 người dùng (xem AdminService)
  // để XP, cấp độ, huy hiệu và bảng xếp hạng phản ánh đúng dữ liệu còn lại.
  // Giả định gọi nơi khác đã dọn xong các XpTransaction mồ côi (referenceId
  // trỏ tới bài thi vừa xóa) trước khi gọi hàm này.
  async recomputeUserProgress(userId: string): Promise<void> {
    const progress = await this.prisma.userProgress.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    // 1. Đếm lại tổng bài nộp / bài đạt từ dữ liệu Submission còn lại
    const [totalSubmissions, totalPassed] = await Promise.all([
      this.prisma.submission.count({ where: { userId } }),
      this.prisma.submission.count({ where: { userId, isPassed: true } }),
    ]);

    // 2. Tính lại XP = tổng các XpTransaction còn lại, rồi suy ra cấp độ
    const recalcXpAndLevel = async () => {
      const agg = await this.prisma.xpTransaction.aggregate({
        where: { userId },
        _sum: { amount: true },
      });
      const xp = agg._sum.amount ?? 0;
      const levelDef = await this.prisma.levelDefinition.findFirst({
        where: { minXp: { lte: xp } },
        orderBy: { minXp: 'desc' },
      });
      return { xp, level: levelDef?.level ?? 1 };
    };
    const { xp, level } = await recalcXpAndLevel();

    await this.prisma.userProgress.update({
      where: { userId },
      data: { xp, level, totalSubmissions, totalPassed },
    });

    // 3. Gỡ những huy hiệu không còn đủ điều kiện với dữ liệu mới (dùng đúng
    //    totalSubmissions/totalPassed/level vừa cập nhật ở bước 2)
    const userBadges = await this.prisma.userBadge.findMany({
      where: { userId },
      select: { badgeDefinitionId: true, badgeDefinition: true },
    });
    const evalProgress = {
      totalSubmissions,
      totalPassed,
      currentStreak: progress.currentStreak,
      totalArenaWins: progress.totalArenaWins,
      level,
    };
    const revokedIds: string[] = [];
    for (const ub of userBadges) {
      const condition = ub.badgeDefinition
        .conditionJson as unknown as BadgeCondition;
      const stillMet = await this.evaluateCondition(
        condition,
        userId,
        evalProgress,
      );
      if (!stillMet) revokedIds.push(ub.badgeDefinitionId);
    }

    if (revokedIds.length > 0) {
      await this.prisma.userBadge.deleteMany({
        where: { userId, badgeDefinitionId: { in: revokedIds } },
      });
      // Thu hồi luôn XP thưởng gắn với các huy hiệu vừa bị gỡ, rồi tính lại XP/cấp độ
      await this.prisma.xpTransaction.deleteMany({
        where: {
          userId,
          source: XpSource.BADGE_BONUS,
          referenceId: { in: revokedIds },
        },
      });
      const after = await recalcXpAndLevel();
      await this.prisma.userProgress.update({
        where: { userId },
        data: { xp: after.xp, level: after.level },
      });
    }

    // 4. Ngược lại, dữ liệu mới cũng có thể vừa đủ điều kiện cho huy hiệu nào
    //    đó trước kia chưa đạt — dùng lại đúng luồng awardXp/checkAndAwardBadges
    //    hiện có để nhất quán (kể cả cộng XP thưởng nếu có).
    await this.checkAndAwardBadges(userId, progress.id);
  }

  async deleteLevel(id: string) {
    const levelDef = await this.prisma.levelDefinition.findUniqueOrThrow({
      where: { id },
    });
    const usersAtLevel = await this.prisma.userProgress.count({
      where: { level: levelDef.level },
    });
    if (usersAtLevel > 0) {
      throw new Error(
        `Không thể xóa cấp ${levelDef.level} vì có ${usersAtLevel} người dùng đang ở cấp này`,
      );
    }
    return this.prisma.levelDefinition.delete({ where: { id } });
  }
}
