import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AttemptStatus, Prisma, XpSource } from '@prisma/client';
import { AssignmentsService } from '../assignments/assignments.service';
import { GamificationService } from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { SaveAttemptAnswersDto } from './dto/save-attempt-answers.dto';
import { StartAttemptDto } from './dto/start-attempt.dto';

interface SnapshotOption {
  id: string;
  content: string;
  isCorrect: boolean;
  orderIndex: number;
}

interface SnapshotQuestion {
  id: string;
  content: string;
  explanation?: string | null;
  questionType: string;
  orderIndex: number;
  points: number;
  options: SnapshotOption[];
}

interface QuizSnapshot {
  quiz: {
    id: string;
    title: string;
    description: string | null;
    topic: string | null;
    durationMin: number;
    passScore: number | null;
  };
  questions: SnapshotQuestion[];
}

type StoredAttempt = {
  id: string;
  assignmentId: string;
  quizId: string;
  quizVersionId: string;
  status: AttemptStatus;
  startedAt: Date;
  deadlineAt: Date;
  lastSavedAt: Date | null;
  answerRevision: number;
  finalizedAt: Date | null;
  timedOut: boolean;
};

const EXPIRY_SWEEP_INTERVAL_MS = 60_000;

@Injectable()
export class AttemptsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttemptsService.name);
  private expiryTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentsService: AssignmentsService,
    private readonly gamification: GamificationService,
  ) {}

  onModuleInit() {
    this.expiryTimer = setInterval(() => {
      void this.finalizeExpiredAttempts();
    }, EXPIRY_SWEEP_INTERVAL_MS);
    this.expiryTimer.unref();
  }

  onModuleDestroy() {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
  }

  async start(userId: string, dto: StartAttemptDto) {
    const existingById = await this.prisma.quizAttempt.findUnique({ where: { id: dto.id } });
    if (existingById) {
      if (existingById.userId !== userId) {
        throw new ForbiddenException('Attempt này không thuộc về bạn');
      }
      return this.get(userId, dto.id);
    }

    const assignments = await this.assignmentsService.getForUser(userId);
    const assignment = assignments.find((item) => item.id === dto.assignmentId);
    if (!assignment) {
      throw new ForbiddenException('Bạn không được phân công bài kiểm tra này');
    }

    const activeAttempt = await this.prisma.quizAttempt.findFirst({
      where: {
        userId,
        assignmentId: assignment.id,
        status: AttemptStatus.IN_PROGRESS,
      },
    });
    if (activeAttempt) return this.get(userId, activeAttempt.id);

    const { version, snapshot } = await this.ensureSnapshot(assignment.quizId);
    const startedAt = new Date();
    const durationDeadline = new Date(
      startedAt.getTime() + snapshot.quiz.durationMin * 60 * 1000,
    );
    const assignmentDeadline = assignment.endAt
      ? new Date(assignment.endAt)
      : undefined;
    const deadlineAt = assignmentDeadline && assignmentDeadline < durationDeadline
      ? assignmentDeadline
      : durationDeadline;

    if (deadlineAt <= startedAt) {
      throw new GoneException('Thời gian làm bài đã kết thúc');
    }

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        id: dto.id,
        userId,
        assignmentId: assignment.id,
        quizId: assignment.quizId,
        quizVersionId: version.id,
        startedAt,
        deadlineAt,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'START_ATTEMPT',
        entityId: attempt.id,
        meta: { assignmentId: assignment.id, deadlineAt: deadlineAt.toISOString() },
      },
    });

    return this.toAttemptPayload(attempt, snapshot, []);
  }

  async get(userId: string, id: string) {
    const attempt = await this.findAttempt(userId, id);
    if (attempt.status === AttemptStatus.IN_PROGRESS && attempt.deadlineAt <= new Date()) {
      await this.finalize(userId, id, true);
      return this.get(userId, id);
    }

    const snapshot = this.readSnapshot(attempt.quizVersion.snapshot);
    return this.toAttemptPayload(attempt, snapshot, attempt.answers);
  }

  async saveAnswers(userId: string, id: string, dto: SaveAttemptAnswersDto) {
    const attempt = await this.findAttempt(userId, id);
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new ConflictException('Bài kiểm tra đã được chấm');
    }
    if (attempt.deadlineAt <= new Date()) {
      await this.finalize(userId, id, true);
      throw new GoneException('Đã hết thời gian làm bài; hệ thống đã chấm bản lưu gần nhất');
    }
    if (dto.revision !== attempt.answerRevision) {
      throw new ConflictException({
        message: 'Dữ liệu cục bộ đã cũ; vui lòng tải lại bài kiểm tra',
        answerRevision: attempt.answerRevision,
      });
    }

    const snapshot = this.readSnapshot(attempt.quizVersion.snapshot);
    this.validateAnswers(snapshot, dto);
    const lastSavedAt = new Date();
    const saveResult = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.quizAttempt.updateMany({
        where: {
          id: attempt.id,
          userId,
          status: AttemptStatus.IN_PROGRESS,
          answerRevision: dto.revision,
          deadlineAt: { gt: lastSavedAt },
        },
        data: {
          answerRevision: { increment: 1 },
          lastSavedAt,
        },
      });

      if (updated.count === 0) {
        const current = await transaction.quizAttempt.findUniqueOrThrow({
          where: { id: attempt.id },
          select: { status: true, deadlineAt: true, answerRevision: true },
        });
        return { saved: false as const, current };
      }

      await Promise.all(
        dto.answers.map((answer) =>
          transaction.quizAttemptAnswer.upsert({
            where: {
              attemptId_questionId: {
                attemptId: attempt.id,
                questionId: answer.questionId,
              },
            },
            create: {
              attemptId: attempt.id,
              questionId: answer.questionId,
              selectedOptionIds: answer.selectedOptionIds,
            },
            update: {
              selectedOptionIds: answer.selectedOptionIds,
            },
          }),
        ),
      );

      const savedAttempt = await transaction.quizAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
        select: { answerRevision: true, lastSavedAt: true },
      });
      return { saved: true as const, attempt: savedAttempt };
    });

    if (saveResult.saved) return saveResult.attempt;

    if (saveResult.current.status !== AttemptStatus.IN_PROGRESS) {
      throw new ConflictException('Bài kiểm tra đã được chấm');
    }
    if (saveResult.current.deadlineAt <= lastSavedAt) {
      await this.finalize(userId, id, true);
      throw new GoneException('Đã hết thời gian làm bài; hệ thống đã chấm bản lưu gần nhất');
    }
    throw new ConflictException({
      message: 'Dữ liệu cục bộ đã cũ; vui lòng tải lại bài kiểm tra',
      answerRevision: saveResult.current.answerRevision,
    });
  }

  async finalize(userId: string, id: string, timedOut: boolean) {
    const attempt = await this.findAttempt(userId, id);
    if (attempt.status === AttemptStatus.GRADED) {
      return this.getFinalResult(userId, attempt.submissionId ?? attempt.id);
    }

    const snapshot = this.readSnapshot(attempt.quizVersion.snapshot);
    const { score, isPassed } = this.scoreAttempt(snapshot, attempt.answers);
    const submittedAt = new Date();

    const existingSubmission = await this.prisma.submission.findUnique({
      where: { id: attempt.id },
    });
    if (existingSubmission) {
      await this.prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          submissionId: existingSubmission.id,
          status: AttemptStatus.GRADED,
          finalizedAt: submittedAt,
          timedOut: timedOut || attempt.timedOut,
        },
      });
      return this.getFinalResult(userId, existingSubmission.id);
    }

    const submission = await this.prisma.submission.create({
      data: {
        id: attempt.id,
        userId,
        quizId: attempt.quizId,
        quizVersionId: attempt.quizVersionId,
        status: 'GRADED',
        score,
        isPassed,
        startedAt: attempt.startedAt,
        submittedAt,
        syncedAt: submittedAt,
        answers: {
          create: attempt.answers.map((answer) => ({
            questionId: answer.questionId,
            selectedOptionIds: this.toSelectedOptionIds(answer.selectedOptionIds),
            answeredAt: answer.updatedAt,
          })),
        },
      },
    });

    await this.prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        submissionId: submission.id,
        status: AttemptStatus.GRADED,
        finalizedAt: submittedAt,
        timedOut: timedOut || attempt.timedOut,
      },
    });
    await this.prisma.auditLog.create({
      data: { userId, action: 'FINALIZE_ATTEMPT', entityId: attempt.id, meta: { timedOut } },
    });

    const xpResult = await this.awardSubmissionXp(userId, isPassed, score, submission.id);
    return {
      id: submission.id,
      status: submission.status,
      score: submission.score,
      isPassed,
      timedOut: timedOut || attempt.timedOut,
      levelUp: xpResult.levelUp,
      newLevel: xpResult.newLevel,
      newBadges: xpResult.newBadges,
    };
  }

  async finalizeExpiredAttempts() {
    try {
      const expiredAttempts = await this.prisma.quizAttempt.findMany({
        where: { status: AttemptStatus.IN_PROGRESS, deadlineAt: { lte: new Date() } },
        select: { id: true, userId: true },
      });
      for (const attempt of expiredAttempts) {
        await this.finalize(attempt.userId, attempt.id, true);
      }
    } catch (error) {
      this.logger.error('Không thể chấm attempt quá hạn', error);
    }
  }

  private async findAttempt(userId: string, id: string) {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id, userId },
      include: {
        answers: { orderBy: { updatedAt: 'asc' } },
        quizVersion: { select: { snapshot: true } },
      },
    });
    if (!attempt) throw new NotFoundException('Không tìm thấy bài kiểm tra đang làm');
    return attempt;
  }

  private async ensureSnapshot(quizId: string) {
    const latestVersion = await this.prisma.quizVersion.findFirst({
      where: { quizId },
      orderBy: { version: 'desc' },
    });
    if (latestVersion && this.isSnapshot(latestVersion.snapshot)) {
      return { version: latestVersion, snapshot: latestVersion.snapshot };
    }

    const [quiz, questions] = await Promise.all([
      this.prisma.quiz.findUniqueOrThrow({ where: { id: quizId } }),
      this.prisma.question.findMany({
        where: { quizId },
        orderBy: { orderIndex: 'asc' },
        include: { options: { orderBy: { orderIndex: 'asc' } } },
      }),
    ]);
    const snapshot: QuizSnapshot = {
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        topic: quiz.topic,
        durationMin: quiz.durationMin,
        passScore: quiz.passScore,
      },
      questions: questions.map((question) => ({
        id: question.id,
        content: question.content,
        explanation: question.explanation,
        questionType: question.questionType,
        orderIndex: question.orderIndex,
        points: question.points,
        options: question.options.map((option) => ({
          id: option.id,
          content: option.content,
          isCorrect: option.isCorrect,
          orderIndex: option.orderIndex,
        })),
      })),
    };
    const version = await this.prisma.quizVersion.create({
      data: {
        quizId,
        version: (latestVersion?.version ?? 0) + 1,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });

    return { version, snapshot };
  }

  private readSnapshot(value: unknown): QuizSnapshot {
    if (!this.isSnapshot(value)) {
      throw new BadRequestException('Bộ đề chưa có phiên bản hợp lệ để làm bài');
    }
    return value;
  }

  private isSnapshot(value: unknown): value is QuizSnapshot {
    if (!value || typeof value !== 'object') return false;
    const snapshot = value as Partial<QuizSnapshot>;
    return Boolean(
      snapshot.quiz &&
      typeof snapshot.quiz.id === 'string' &&
      typeof snapshot.quiz.durationMin === 'number' &&
      Array.isArray(snapshot.questions),
    );
  }

  private toAttemptPayload(
    attempt: StoredAttempt,
    snapshot: QuizSnapshot,
    answers: Array<{ questionId: string; selectedOptionIds: Prisma.JsonValue }>,
  ) {
    return {
      attempt: {
        id: attempt.id,
        assignmentId: attempt.assignmentId,
        quizId: attempt.quizId,
        quizVersionId: attempt.quizVersionId,
        status: attempt.status,
        startedAt: attempt.startedAt,
        deadlineAt: attempt.deadlineAt,
        lastSavedAt: attempt.lastSavedAt,
        answerRevision: attempt.answerRevision,
        finalizedAt: attempt.finalizedAt,
        timedOut: attempt.timedOut,
      },
      quiz: {
        ...snapshot.quiz,
        questions: snapshot.questions.map((question) => ({
          id: question.id,
          content: question.content,
          questionType: question.questionType,
          orderIndex: question.orderIndex,
          points: question.points,
          options: question.options.map((option) => ({
            id: option.id,
            content: option.content,
            orderIndex: option.orderIndex,
          })),
        })),
      },
      answers: answers.map((answer) => ({
        questionId: answer.questionId,
        selectedOptionIds: answer.selectedOptionIds,
      })),
    };
  }

  private validateAnswers(snapshot: QuizSnapshot, dto: SaveAttemptAnswersDto) {
    const questions = new Map(snapshot.questions.map((question) => [question.id, question]));
    for (const answer of dto.answers) {
      const question = questions.get(answer.questionId);
      if (!question) throw new BadRequestException('Câu trả lời không thuộc bộ đề này');
      const optionIds = new Set(question.options.map((option) => option.id));
      if (answer.selectedOptionIds.some((optionId) => !optionIds.has(optionId))) {
        throw new BadRequestException('Phương án trả lời không hợp lệ');
      }
      if (question.questionType === 'SINGLE' && answer.selectedOptionIds.length > 1) {
        throw new BadRequestException('Câu hỏi một đáp án chỉ được chọn một phương án');
      }
    }
  }

  private scoreAttempt(
    snapshot: QuizSnapshot,
    answers: Array<{ questionId: string; selectedOptionIds: Prisma.JsonValue }>,
  ) {
    const answersByQuestion = new Map(
      answers.map((answer) => [
        answer.questionId,
        this.toSelectedOptionIds(answer.selectedOptionIds).sort(),
      ]),
    );
    let totalPoints = 0;
    let earnedPoints = 0;

    for (const question of snapshot.questions) {
      totalPoints += question.points;
      const correctOptionIds = question.options
        .filter((option) => option.isCorrect)
        .map((option) => option.id)
        .sort();
      const selectedOptionIds = answersByQuestion.get(question.id) ?? [];
      if (JSON.stringify(correctOptionIds) === JSON.stringify(selectedOptionIds)) {
        earnedPoints += question.points;
      }
    }

    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    return {
      score,
      isPassed: score >= (snapshot.quiz.passScore ?? 60),
    };
  }

  private toSelectedOptionIds(value: Prisma.JsonValue): string[] {
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === 'string')
      : [];
  }

  private async getFinalResult(userId: string, submissionId: string) {
    const submission = await this.prisma.submission.findFirst({
      where: { id: submissionId, userId },
      select: { id: true, status: true, score: true, isPassed: true, submittedAt: true },
    });
    if (!submission) throw new NotFoundException('Không tìm thấy kết quả bài kiểm tra');
    return submission;
  }

  private async awardSubmissionXp(
    userId: string,
    isPassed: boolean,
    score: number,
    submissionId: string,
  ) {
    await this.gamification.updateActivity(userId);
    await this.gamification.incrementSubmissionStats(userId, isPassed);
    if (score === 100) {
      const passResult = await this.gamification.awardXp(userId, 50, XpSource.EXAM_PASS, submissionId);
      const perfectResult = await this.gamification.awardXp(
        userId,
        50,
        XpSource.EXAM_PERFECT,
        submissionId,
        'Điểm tuyệt đối',
      );
      return {
        levelUp: passResult.levelUp || perfectResult.levelUp,
        newLevel: Math.max(passResult.newLevel, perfectResult.newLevel),
        newBadges: [...passResult.newBadges, ...perfectResult.newBadges],
      };
    }
    return this.gamification.awardXp(
      userId,
      isPassed ? 50 : 20,
      isPassed ? XpSource.EXAM_PASS : XpSource.EXAM_FAIL,
      submissionId,
    );
  }
}