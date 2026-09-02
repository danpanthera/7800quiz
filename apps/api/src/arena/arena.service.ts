import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArenaDto } from './dto/create-arena.dto';
import { ArenaStatus, ArenaRoundStatus, XpSource } from '@prisma/client';
import { GamificationService } from '../gamification/gamification.service';

const TEAM_COLORS = [
  '#E74C3C', '#3498DB', '#2ECC71', '#F39C12',
  '#9B59B6', '#1ABC9C', '#E67E22', '#2C3E50', '#F1C40F',
];

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

@Injectable()
export class ArenaService {
  constructor(
    private prisma: PrismaService,
    private gamification: GamificationService,
  ) {}

  // ─── HTTP ─────────────────────────────────────────────────────────────────

  async createSession(dto: CreateArenaDto) {
    // Verify quiz exists
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: dto.quizId },
      include: { questions: { include: { options: true } } },
    });
    if (!quiz) throw new NotFoundException('Quiz không tồn tại');

    // Generate unique joinCode
    let joinCode: string;
    let attempts = 0;
    do {
      joinCode = generateJoinCode();
      const existing = await this.prisma.arenaSession.findUnique({ where: { joinCode } });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    const pointsForRank = dto.pointsForRank ?? [10, 7, 5, 3, 2, 2, 2, 2, 2];

    const session = await this.prisma.arenaSession.create({
      data: {
        name: dto.name,
        quizId: dto.quizId,
        joinCode,
        hostMode: dto.hostMode ?? 'MANUAL',
        autoAdvanceSec: dto.autoAdvanceSec ?? 10,
        pointsForRank,
        penaltyWrong: dto.penaltyWrong ?? 0,
      },
    });

    // Pre-create ArenaRounds from quiz questions
    const questions = quiz.questions.sort((a, b) => a.orderIndex - b.orderIndex);
    if (questions.length > 0) {
      await this.prisma.arenaRound.createMany({
        data: questions.map((q, idx) => ({
          arenaSessionId: session.id,
          questionId: q.id,
          order: idx,
        })),
      });
    }

    return this.getSessionDetail(session.id);
  }

  async listSessions() {
    return this.prisma.arenaSession.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        quiz: { select: { id: true, title: true } },
        teams: { select: { id: true, name: true, color: true, score: true, rank: true } },
        _count: { select: { rounds: true } },
      },
    });
  }

  async getSessionDetail(id: string) {
    const session = await this.prisma.arenaSession.findUnique({
      where: { id },
      include: {
        quiz: { select: { id: true, title: true, durationMin: true } },
        teams: { orderBy: { score: 'desc' } },
        rounds: {
          orderBy: { order: 'asc' },
          include: {
            question: { include: { options: true } },
            buzzes: { include: { team: true }, orderBy: { answeredAt: 'asc' } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Arena session không tồn tại');
    return session;
  }

  async getSessionByJoinCode(joinCode: string) {
    const session = await this.prisma.arenaSession.findUnique({
      where: { joinCode },
      include: {
        quiz: { select: { id: true, title: true } },
        teams: { select: { id: true, name: true, color: true, score: true } },
        _count: { select: { rounds: true } },
      },
    });
    if (!session) throw new NotFoundException('Mã tham gia không hợp lệ');
    return session;
  }

  async deleteSession(id: string) {
    await this.prisma.arenaSession.findUniqueOrThrow({ where: { id } });
    return this.prisma.arenaSession.delete({ where: { id } });
  }

  async cancelSession(id: string) {
    const session = await this.prisma.arenaSession.findUniqueOrThrow({ where: { id } });
    if (session.status !== ArenaStatus.LOBBY)
      throw new BadRequestException('Chỉ có thể hủy phiên đang ở trạng thái chờ');
    return this.prisma.arenaSession.delete({ where: { id } });
  }

  async stopSession(id: string) {
    const session = await this.prisma.arenaSession.findUniqueOrThrow({ where: { id } });
    if (session.status !== ArenaStatus.RUNNING)
      throw new BadRequestException('Chỉ có thể dừng phiên đang chạy');
    return this.endSession(id);
  }

  // ─── Socket.IO Business Logic ──────────────────────────────────────────────

  async joinTeam(joinCode: string, teamName: string) {
    const session = await this.prisma.arenaSession.findUnique({
      where: { joinCode },
      include: { teams: true },
    });
    if (!session) throw new BadRequestException('Mã tham gia không hợp lệ');
    if (session.status !== ArenaStatus.LOBBY)
      throw new BadRequestException('Phiên đấu đã bắt đầu hoặc kết thúc');
    if (session.teams.length >= 9)
      throw new BadRequestException('Phiên đã đủ 9 đội');

    const existingName = session.teams.find(
      (t) => t.name.toLowerCase() === teamName.toLowerCase(),
    );
    if (existingName) throw new BadRequestException('Tên đội đã tồn tại trong phiên này');

    const color = TEAM_COLORS[session.teams.length];
    const team = await this.prisma.arenaTeam.create({
      data: { arenaSessionId: session.id, name: teamName, color },
    });

    return { session, team };
  }

  async startSession(sessionId: string) {
    const session = await this.prisma.arenaSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { teams: true, rounds: { orderBy: { order: 'asc' } } },
    });
    if (session.status !== ArenaStatus.LOBBY)
      throw new BadRequestException('Phiên không ở trạng thái LOBBY');
    if (session.teams.length < 2)
      throw new BadRequestException('Cần ít nhất 2 đội để bắt đầu');
    if (session.rounds.length === 0)
      throw new BadRequestException('Quiz không có câu hỏi');

    await this.prisma.arenaSession.update({
      where: { id: sessionId },
      data: { status: ArenaStatus.RUNNING, currentRoundOrder: 0 },
    });

    return this.showQuestion(sessionId, 0);
  }

  async showQuestion(sessionId: string, order: number) {
    const session = await this.prisma.arenaSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    if (session.status !== ArenaStatus.RUNNING)
      throw new BadRequestException('Phiên không đang chạy');

    // Mark previous round as REVEALED if still ACTIVE
    await this.prisma.arenaRound.updateMany({
      where: { arenaSessionId: sessionId, status: ArenaRoundStatus.ACTIVE },
      data: { status: ArenaRoundStatus.REVEALED, revealedAt: new Date() },
    });

    const round = await this.prisma.arenaRound.findUnique({
      where: { arenaSessionId_order: { arenaSessionId: sessionId, order } },
      include: { question: { include: { options: true } } },
    });
    if (!round) throw new BadRequestException('Câu hỏi không tồn tại');

    await this.prisma.arenaRound.update({
      where: { id: round.id },
      data: { status: ArenaRoundStatus.ACTIVE, startedAt: new Date() },
    });
    await this.prisma.arenaSession.update({
      where: { id: sessionId },
      data: { currentRoundOrder: order },
    });

    // Return question WITHOUT correct answer info
    return {
      roundId: round.id,
      order: round.order,
      question: {
        id: round.question.id,
        content: round.question.content,
        questionType: round.question.questionType,
        options: round.question.options.map((o) => ({
          id: o.id,
          content: o.content,
        })),
      },
      autoAdvanceSec: session.autoAdvanceSec,
      hostMode: session.hostMode,
    };
  }

  async recordAnswer(arenaRoundId: string, teamId: string, selectedOptionIds: string[]) {
    const round = await this.prisma.arenaRound.findUnique({
      where: { id: arenaRoundId },
      include: {
        question: { include: { options: true } },
        arenaSession: true,
      },
    });
    if (!round) throw new BadRequestException('Round không tồn tại');
    if (round.status !== ArenaRoundStatus.ACTIVE)
      throw new BadRequestException('Round không đang active');

    // Check team belongs to session
    const team = await this.prisma.arenaTeam.findFirst({
      where: { id: teamId, arenaSessionId: round.arenaSessionId },
    });
    if (!team) throw new BadRequestException('Đội không thuộc phiên này');

    // Check not already answered
    const existingBuzz = await this.prisma.arenaBuzz.findUnique({
      where: { arenaRoundId_teamId: { arenaRoundId, teamId } },
    });
    if (existingBuzz) throw new BadRequestException('Đội đã trả lời câu này');

    // Server-side correctness check
    const correctOptionIds = round.question.options
      .filter((o) => o.isCorrect)
      .map((o) => o.id)
      .sort();
    const selectedSorted = [...selectedOptionIds].sort();
    const isCorrect = JSON.stringify(correctOptionIds) === JSON.stringify(selectedSorted);

    const buzz = await this.prisma.arenaBuzz.create({
      data: {
        arenaRoundId,
        teamId,
        selectedOptionIds,
        answeredAt: new Date(),
        isCorrect,
        pointsAwarded: 0, // will be calculated on reveal
      },
    });

    return { buzz, isCorrect, teamName: team.name, teamColor: team.color };
  }

  async revealRound(sessionId: string) {
    const session = await this.prisma.arenaSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { teams: true },
    });
    if (session.status !== ArenaStatus.RUNNING)
      throw new BadRequestException('Phiên không đang chạy');

    const round = await this.prisma.arenaRound.findUnique({
      where: {
        arenaSessionId_order: {
          arenaSessionId: sessionId,
          order: session.currentRoundOrder,
        },
      },
      include: {
        question: { include: { options: true } },
        buzzes: { orderBy: { answeredAt: 'asc' } },
      },
    });
    if (!round) throw new BadRequestException('Round không tồn tại');
    if (round.status !== ArenaRoundStatus.ACTIVE)
      throw new BadRequestException('Round không đang active');

    const pointsForRank = session.pointsForRank as number[];
    const penaltyWrong = session.penaltyWrong;

    // Rank correct buzzes by answeredAt
    const correctBuzzes = round.buzzes.filter((b) => b.isCorrect);
    const wrongBuzzes = round.buzzes.filter((b) => !b.isCorrect);

    // Assign points
    for (let i = 0; i < correctBuzzes.length; i++) {
      const pts = pointsForRank[i] ?? pointsForRank[pointsForRank.length - 1];
      await this.prisma.arenaBuzz.update({
        where: { id: correctBuzzes[i].id },
        data: { correctRank: i + 1, pointsAwarded: pts },
      });
      await this.prisma.arenaTeam.update({
        where: { id: correctBuzzes[i].teamId },
        data: { score: { increment: pts } },
      });
    }
    for (const buzz of wrongBuzzes) {
      if (penaltyWrong > 0) {
        await this.prisma.arenaBuzz.update({
          where: { id: buzz.id },
          data: { pointsAwarded: -penaltyWrong },
        });
        await this.prisma.arenaTeam.update({
          where: { id: buzz.teamId },
          data: { score: { decrement: penaltyWrong } },
        });
      }
    }

    // Mark round REVEALED
    await this.prisma.arenaRound.update({
      where: { id: round.id },
      data: { status: ArenaRoundStatus.REVEALED, revealedAt: new Date() },
    });

    // Refresh teams with updated scores
    const updatedTeams = await this.prisma.arenaTeam.findMany({
      where: { arenaSessionId: sessionId },
      orderBy: { score: 'desc' },
    });

    return {
      roundId: round.id,
      correctOptionIds: round.question.options.filter((o) => o.isCorrect).map((o) => o.id),
      explanation: round.question.explanation,
      buzzes: [...correctBuzzes, ...wrongBuzzes].map((b) => ({
        teamId: b.teamId,
        isCorrect: b.isCorrect,
        pointsAwarded:
          b.isCorrect
            ? (pointsForRank[correctBuzzes.indexOf(b)] ?? pointsForRank[pointsForRank.length - 1])
            : -penaltyWrong,
      })),
      leaderboard: updatedTeams,
    };
  }

  async nextQuestion(sessionId: string) {
    const session = await this.prisma.arenaSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { _count: { select: { rounds: true } } },
    });
    const nextOrder = session.currentRoundOrder + 1;
    if (nextOrder >= session._count.rounds) {
      return this.endSession(sessionId);
    }
    const questionData = await this.showQuestion(sessionId, nextOrder);
    return { type: 'next', ...questionData };
  }

  async endSession(sessionId: string) {
    const teams = await this.prisma.arenaTeam.findMany({
      where: { arenaSessionId: sessionId },
      orderBy: [{ score: 'desc' }, { joinedAt: 'asc' }],
    });

    // Assign final ranks
    for (let i = 0; i < teams.length; i++) {
      await this.prisma.arenaTeam.update({
        where: { id: teams[i].id },
        data: { rank: i + 1 },
      });
    }

    await this.prisma.arenaSession.update({
      where: { id: sessionId },
      data: { status: ArenaStatus.FINISHED },
    });

    // TODO Sprint 9: Arena XP — cần thêm userId tracking vào ArenaTeam trước khi award XP
    // Hiện tại ArenaTeam là team Kahoot, không track individual user.

    return {
      type: 'ended',
      ranking: teams.map((t, i) => ({ ...t, rank: i + 1 })),
    };
  }
}
