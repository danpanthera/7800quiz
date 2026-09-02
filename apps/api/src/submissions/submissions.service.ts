import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitDto } from './dto/submit.dto';
import { GamificationService } from '../gamification/gamification.service';
import { XpSource } from '@prisma/client';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  async submit(userId: string, dto: SubmitDto) {
    // Idempotency — nếu đã tồn tại submission với ID này thì trả về luôn
    const existing = await this.prisma.submission.findUnique({ where: { id: dto.id } });
    if (existing) {
      return { id: existing.id, status: existing.status, score: existing.score };
    }

    // Nếu quizVersionId rỗng, tự tìm version mới nhất
    let resolvedVersionId = dto.quizVersionId;
    if (!resolvedVersionId) {
      const latestVersion = await this.prisma.quizVersion.findFirst({
        where: { quizId: dto.quizId },
        orderBy: { version: 'desc' },
      });
      if (latestVersion) {
        resolvedVersionId = latestVersion.id;
      } else {
        // Chưa có version, tạo mới
        const newVersion = await this.prisma.quizVersion.create({
          data: { quizId: dto.quizId, version: 1, snapshot: {} },
        });
        resolvedVersionId = newVersion.id;
      }
    }

    // Lấy đáp án đúng để chấm điểm + passScore của quiz
    const [questions, quiz] = await Promise.all([
      this.prisma.question.findMany({
        where: { quizId: dto.quizId },
        include: { options: { where: { isCorrect: true } } },
      }),
      this.prisma.quiz.findUnique({ where: { id: dto.quizId }, select: { passScore: true } }),
    ]);

    let totalPoints = 0;
    let earnedPoints = 0;

    for (const q of questions) {
      totalPoints += q.points;
      const correctIds = q.options.map((o) => o.id).sort();
      const answer = dto.answers.find((a) => a.questionId === q.id);
      if (answer) {
        const selectedIds = [...answer.selectedOptionIds].sort();
        if (JSON.stringify(correctIds) === JSON.stringify(selectedIds)) {
          earnedPoints += q.points;
        }
      }
    }

    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

    const submission = await this.prisma.submission.create({
      data: {
        id: dto.id,
        userId,
        quizId: dto.quizId,
        quizVersionId: resolvedVersionId,
        status: 'GRADED',
        score,
        startedAt: new Date(dto.startedAt),
        submittedAt: new Date(dto.submittedAt),
        syncedAt: new Date(),
        answers: {
          create: dto.answers.map((a) => ({
            questionId: a.questionId,
            selectedOptionIds: a.selectedOptionIds,
            answeredAt: new Date(a.answeredAt),
          })),
        },
      },
    });

    await this.prisma.auditLog.create({
      data: { userId, action: 'SUBMIT', entityId: submission.id },
    });

    // ── Gamification: award XP ────────────────────────────────────────────
    const isPassed = quiz ? score >= (quiz.passScore ?? 60) : false;
    await this.gamification.updateActivity(userId);
    await this.gamification.incrementSubmissionStats(userId, isPassed);

    let xpResult: { levelUp: boolean; newLevel: number; newBadges: { code: string; name: string; iconSlug: string }[] };
    if (score === 100) {
      // Pass + perfect
      const passResult = await this.gamification.awardXp(userId, 50, XpSource.EXAM_PASS, submission.id);
      const perfectResult = await this.gamification.awardXp(userId, 50, XpSource.EXAM_PERFECT, submission.id, 'Điểm tuyệt đối');
      xpResult = {
        levelUp: passResult.levelUp || perfectResult.levelUp,
        newLevel: Math.max(passResult.newLevel, perfectResult.newLevel),
        newBadges: [...passResult.newBadges, ...perfectResult.newBadges],
      };
    } else if (isPassed) {
      xpResult = await this.gamification.awardXp(userId, 50, XpSource.EXAM_PASS, submission.id);
    } else {
      xpResult = await this.gamification.awardXp(userId, 20, XpSource.EXAM_FAIL, submission.id);
    }
    // ─────────────────────────────────────────────────────────────────────

    return {
      id: submission.id,
      status: submission.status,
      score: submission.score,
      levelUp: xpResult.levelUp,
      newLevel: xpResult.newLevel,
      newBadges: xpResult.newBadges,
    };
  }

  async getResult(submissionId: string, userId: string) {
    // Trả về null nếu chưa sync lên server thay vì throw 500
    return this.prisma.submission.findFirst({
      where: { id: submissionId, userId },
      select: {
        id: true,
        score: true,
        isPassed: true,
        status: true,
        submittedAt: true,
        syncedAt: true,
      },
    });
  }
}
