import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArenaDto } from './dto/create-arena.dto';
import { ArenaStatus, ArenaRoundStatus, XpSource } from '@prisma/client';
import { GamificationService } from '../gamification/gamification.service';

const TEAM_COLORS = [
  '#E74C3C',
  '#3498DB',
  '#2ECC71',
  '#F39C12',
  '#9B59B6',
  '#1ABC9C',
  '#E67E22',
  '#2C3E50',
  '#F1C40F',
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
      const existing = await this.prisma.arenaSession.findUnique({
        where: { joinCode },
      });
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
        passcode: dto.passcode?.trim() || null,
      },
    });

    // Pre-create ArenaRounds from quiz questions
    const questions = quiz.questions.sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
    if (questions.length > 0) {
      await this.prisma.arenaRound.createMany({
        data: questions.map((q, idx) => ({
          arenaSessionId: session.id,
          questionId: q.id,
          order: idx,
        })),
      });
    }

    // Danh sách mời — có >=1 userId thì phòng trở thành allowlist
    const invitedUserIds = [...new Set(dto.invitedUserIds ?? [])];
    if (invitedUserIds.length > 0) {
      await this.prisma.arenaInvite.createMany({
        data: invitedUserIds.map((userId) => ({
          arenaSessionId: session.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    // Đội đặt trước — tối đa 8 đội, 0 người ban đầu, người chơi tự chọn vào lúc join
    const presetNames = (dto.presetTeamNames ?? [])
      .map((n) => n.trim())
      .filter(Boolean);
    if (presetNames.length > 0) {
      await this.prisma.arenaTeam.createMany({
        data: presetNames.map((name, idx) => ({
          arenaSessionId: session.id,
          name,
          color: TEAM_COLORS[idx % TEAM_COLORS.length],
          isPreset: true,
        })),
      });
    }

    return this.getSessionDetail(session.id);
  }

  // Danh sách đội đã làm phẳng members về {userId, fullName} — dùng lại cho
  // các thao tác thay đổi roster (kick/merge/move) để trả cùng 1 shape
  private async getTeamsFlat(sessionId: string) {
    const teams = await this.prisma.arenaTeam.findMany({
      where: { arenaSessionId: sessionId },
      orderBy: { joinedAt: 'asc' },
      include: {
        members: {
          include: { user: { select: { id: true, fullName: true } } },
        },
      },
    });
    return teams.map((t) => ({
      ...t,
      members: t.members.map((m) => ({
        userId: m.userId,
        fullName: m.user.fullName,
      })),
    }));
  }

  async listSessions() {
    const sessions = await this.prisma.arenaSession.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        quiz: { select: { id: true, title: true } },
        teams: {
          select: {
            id: true,
            name: true,
            color: true,
            score: true,
            rank: true,
            isPreset: true,
            members: {
              select: {
                userId: true,
                user: { select: { fullName: true } },
              },
            },
          },
        },
        invites: {
          include: { user: { select: { id: true, fullName: true } } },
        },
        _count: { select: { rounds: true } },
      },
    });
    // Làm phẳng members về {userId, fullName} cho khớp shape các endpoint khác
    return sessions.map((s) => ({
      ...s,
      teams: s.teams.map((t) => ({
        ...t,
        members: t.members.map((m) => ({
          userId: m.userId,
          fullName: m.user.fullName,
        })),
      })),
    }));
  }

  async getSessionDetail(id: string) {
    const session = await this.prisma.arenaSession.findUnique({
      where: { id },
      include: {
        quiz: { select: { id: true, title: true, durationMin: true } },
        teams: {
          orderBy: { score: 'desc' },
          include: {
            members: {
              include: { user: { select: { id: true, fullName: true } } },
            },
          },
        },
        invites: {
          include: { user: { select: { id: true, fullName: true } } },
        },
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
    // Làm phẳng members về {userId, fullName} cho khớp shape các endpoint khác
    return {
      ...session,
      teams: session.teams.map((t) => ({
        ...t,
        members: t.members.map((m) => ({
          userId: m.userId,
          fullName: m.user.fullName,
        })),
      })),
    };
  }

  async getSessionByJoinCode(joinCode: string) {
    const session = await this.prisma.arenaSession.findUnique({
      where: { joinCode },
      include: {
        quiz: { select: { id: true, title: true } },
        teams: {
          select: {
            id: true,
            name: true,
            color: true,
            score: true,
            isPreset: true,
            _count: { select: { members: true } },
          },
        },
        invites: { select: { userId: true } },
        _count: { select: { rounds: true } },
      },
    });
    if (!session) throw new NotFoundException('Mã tham gia không hợp lệ');
    // Endpoint public (chưa đăng nhập) — không được lộ giá trị mật khẩu thật
    // hay danh sách tên được mời, chỉ báo cờ để client hiện đúng cảnh báo.
    const { passcode, invites, ...rest } = session;
    return {
      ...rest,
      teams: rest.teams.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        score: t.score,
        isPreset: t.isPreset,
        memberCount: t._count.members,
      })),
      requiresPasscode: !!passcode,
      isInviteOnly: invites.length > 0,
    };
  }

  async deleteSession(id: string) {
    await this.prisma.arenaSession.findUniqueOrThrow({ where: { id } });
    return this.prisma.arenaSession.delete({ where: { id } });
  }

  async cancelSession(id: string) {
    const session = await this.prisma.arenaSession.findUniqueOrThrow({
      where: { id },
    });
    if (session.status !== ArenaStatus.LOBBY)
      throw new BadRequestException(
        'Chỉ có thể hủy phiên đang ở trạng thái chờ',
      );
    return this.prisma.arenaSession.delete({ where: { id } });
  }

  async stopSession(id: string) {
    const session = await this.prisma.arenaSession.findUniqueOrThrow({
      where: { id },
    });
    if (session.status !== ArenaStatus.RUNNING)
      throw new BadRequestException('Chỉ có thể dừng phiên đang chạy');
    return this.endSession(id);
  }

  // ─── Socket.IO Business Logic ──────────────────────────────────────────────

  async joinTeam(
    joinCode: string,
    userId: string,
    opts: { teamName?: string; teamId?: string; passcode?: string },
  ) {
    const session = await this.prisma.arenaSession.findUnique({
      where: { joinCode },
      include: { teams: { include: { members: true } }, invites: true },
    });
    if (!session) throw new BadRequestException('Mã tham gia không hợp lệ');
    if (session.status !== ArenaStatus.LOBBY)
      throw new BadRequestException('Phiên đấu đã bắt đầu hoặc kết thúc');

    // Đã tham gia trước đó (vd: refresh trang) — trả lại đúng đội cũ, không tạo mới,
    // không bắt kiểm tra lại mật khẩu/allowlist vì đã qua vòng kiểm tra lúc join lần đầu
    const existingMembership = await this.prisma.arenaTeamMember.findUnique({
      where: {
        arenaSessionId_userId: { arenaSessionId: session.id, userId },
      },
      include: {
        arenaTeam: {
          include: {
            members: {
              include: { user: { select: { id: true, fullName: true } } },
            },
          },
        },
      },
    });
    if (existingMembership)
      return { session, team: existingMembership.arenaTeam };

    // Phòng allowlist (có >=1 lời mời) — chỉ userId nằm trong danh sách mới được vào
    if (
      session.invites.length > 0 &&
      !session.invites.some((i) => i.userId === userId)
    )
      throw new BadRequestException(
        'Bạn không có trong danh sách được mời tham gia phòng này',
      );

    if (session.passcode && session.passcode !== (opts.passcode ?? '').trim())
      throw new BadRequestException('Sai mật khẩu phòng');

    const presetTeams = session.teams.filter((t) => t.isPreset);

    // Có đội đặt trước sẵn — bắt buộc chọn 1 đội, không tự gõ tên đội mới
    if (presetTeams.length > 0) {
      if (!opts.teamId)
        throw new BadRequestException('Chọn 1 đội để tham gia');
      const target = presetTeams.find((t) => t.id === opts.teamId);
      if (!target)
        throw new BadRequestException('Đội không tồn tại trong phiên này');
      if (target.members.length >= 5)
        throw new BadRequestException('Đội đã đủ 5 người, chọn đội khác');

      await this.prisma.arenaTeamMember.create({
        data: { arenaSessionId: session.id, arenaTeamId: target.id, userId },
      });
      const team = await this.prisma.arenaTeam.findUniqueOrThrow({
        where: { id: target.id },
        include: {
          members: {
            include: { user: { select: { id: true, fullName: true } } },
          },
        },
      });
      return { session, team };
    }

    // Không có đội đặt trước — giữ hành vi cũ: tự gõ tên đội mới
    const teamName = opts.teamName?.trim();
    if (!teamName) throw new BadRequestException('Nhập tên đội để tham gia');

    if (session.teams.length >= 9)
      throw new BadRequestException('Phiên đã đủ 9 đội');

    const existingName = session.teams.find(
      (t) => t.name.toLowerCase() === teamName.toLowerCase(),
    );
    if (existingName)
      throw new BadRequestException('Tên đội đã tồn tại trong phiên này');

    const color = TEAM_COLORS[session.teams.length];
    const team = await this.prisma.arenaTeam.create({
      data: {
        arenaSessionId: session.id,
        name: teamName,
        color,
        members: { create: { arenaSessionId: session.id, userId } },
      },
      include: {
        members: {
          include: { user: { select: { id: true, fullName: true } } },
        },
      },
    });

    return { session, team };
  }

  async kickTeam(sessionId: string, teamId: string) {
    const session = await this.prisma.arenaSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    if (session.status !== ArenaStatus.LOBBY)
      throw new BadRequestException(
        'Chỉ có thể mời người chơi ra khi phiên đang ở sảnh chờ',
      );
    const team = await this.prisma.arenaTeam.findFirst({
      where: { id: teamId, arenaSessionId: sessionId },
    });
    if (!team) throw new NotFoundException('Đội không tồn tại trong phiên này');

    if (team.isPreset) {
      // Đội đặt trước: chỉ xoá hết thành viên, giữ lại slot cho người khác chọn vào
      await this.prisma.arenaTeamMember.deleteMany({
        where: { arenaTeamId: teamId },
      });
    } else {
      await this.prisma.arenaTeam.delete({ where: { id: teamId } });
    }
    return {
      teamId,
      teamName: team.name,
      allTeams: await this.getTeamsFlat(sessionId),
    };
  }

  // MC gỡ 1 người chơi cụ thể khỏi đội (khác kickTeam — không đụng các thành
  // viên còn lại trong cùng đội)
  async kickMember(sessionId: string, teamId: string, userId: string) {
    const session = await this.prisma.arenaSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    if (session.status !== ArenaStatus.LOBBY)
      throw new BadRequestException(
        'Chỉ có thể mời người chơi ra khi phiên đang ở sảnh chờ',
      );
    const member = await this.prisma.arenaTeamMember.findFirst({
      where: { arenaTeamId: teamId, userId, arenaSessionId: sessionId },
      include: { arenaTeam: true },
    });
    if (!member) throw new NotFoundException('Người chơi không thuộc đội này');

    await this.prisma.arenaTeamMember.delete({ where: { id: member.id } });

    // Đội tự phát sinh (không phải đặt trước) mà hết người thì dọn luôn
    if (!member.arenaTeam.isPreset) {
      const remaining = await this.prisma.arenaTeamMember.count({
        where: { arenaTeamId: teamId },
      });
      if (remaining === 0)
        await this.prisma.arenaTeam.delete({ where: { id: teamId } });
    }

    return { userId, allTeams: await this.getTeamsFlat(sessionId) };
  }

  // MC chuyển 1 người chơi sang đội khác trong cùng phiên (đội đích tối đa 5 người)
  async moveMember(sessionId: string, userId: string, targetTeamId: string) {
    const session = await this.prisma.arenaSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    if (session.status !== ArenaStatus.LOBBY)
      throw new BadRequestException(
        'Chỉ có thể chuyển đội khi phiên đang ở sảnh chờ',
      );

    const member = await this.prisma.arenaTeamMember.findUnique({
      where: {
        arenaSessionId_userId: { arenaSessionId: sessionId, userId },
      },
    });
    if (!member)
      throw new BadRequestException('Người chơi không thuộc phiên này');
    if (member.arenaTeamId === targetTeamId)
      throw new BadRequestException('Người chơi đã ở đội này');

    const targetTeam = await this.prisma.arenaTeam.findFirst({
      where: { id: targetTeamId, arenaSessionId: sessionId },
      include: { members: true },
    });
    if (!targetTeam)
      throw new NotFoundException('Đội đích không tồn tại trong phiên này');
    if (targetTeam.members.length >= 5)
      throw new BadRequestException('Đội đích đã đủ 5 người');

    const sourceTeamId = member.arenaTeamId;
    await this.prisma.arenaTeamMember.update({
      where: { id: member.id },
      data: { arenaTeamId: targetTeamId },
    });

    // Dọn đội nguồn nếu hết người và không phải đội đặt trước
    const sourceTeam = await this.prisma.arenaTeam.findUnique({
      where: { id: sourceTeamId },
    });
    if (sourceTeam && !sourceTeam.isPreset) {
      const remaining = await this.prisma.arenaTeamMember.count({
        where: { arenaTeamId: sourceTeamId },
      });
      if (remaining === 0)
        await this.prisma.arenaTeam.delete({ where: { id: sourceTeamId } });
    }

    return {
      userId,
      sourceTeamId,
      targetTeamId,
      targetTeamName: targetTeam.name,
      targetTeamColor: targetTeam.color,
      allTeams: await this.getTeamsFlat(sessionId),
    };
  }

  // MC gộp 2-5 người chơi (đang là đội đơn hoặc đội đã gộp trước đó) thành 1 đội
  // chung điểm số + chung lượt buzz-in. Chỉ cho phép khi còn ở sảnh chờ vì lúc
  // đó chắc chắn chưa có buzz nào cần xử lý dồn/tách. Không áp dụng cho đội
  // đặt trước (dùng "Chuyển đội" để điều chỉnh đội đặt trước thay vì gộp).
  async mergeTeams(sessionId: string, teamIds: string[], teamName?: string) {
    const uniqueIds = [...new Set(teamIds ?? [])];
    if (uniqueIds.length < 2)
      throw new BadRequestException('Chọn ít nhất 2 người/đội để gộp');

    const session = await this.prisma.arenaSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    if (session.status !== ArenaStatus.LOBBY)
      throw new BadRequestException('Chỉ có thể gộp đội khi phiên đang ở sảnh chờ');

    const teams = await this.prisma.arenaTeam.findMany({
      where: { id: { in: uniqueIds }, arenaSessionId: sessionId },
      include: { members: true },
    });
    if (teams.length !== uniqueIds.length)
      throw new BadRequestException('Một số đội không tồn tại trong phiên này');

    if (teams.some((t) => t.isPreset))
      throw new BadRequestException(
        'Không thể gộp đội đã đặt tên trước — dùng chức năng "Chuyển đội" để điều chỉnh',
      );

    const totalMembers = teams.reduce((sum, t) => sum + t.members.length, 0);
    if (totalMembers < 2 || totalMembers > 5)
      throw new BadRequestException('Một đội gộp phải có từ 2 đến 5 người chơi');

    // Đội sống sót = đội vào phòng sớm nhất trong nhóm chọn, các đội còn lại
    // chuyển hết member sang rồi xoá (an toàn vì đang LOBBY, chưa có buzz nào)
    const [survivor, ...removed] = [...teams].sort(
      (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime(),
    );

    await this.prisma.$transaction([
      this.prisma.arenaTeamMember.updateMany({
        where: { arenaTeamId: { in: removed.map((t) => t.id) } },
        data: { arenaTeamId: survivor.id },
      }),
      this.prisma.arenaTeam.deleteMany({
        where: { id: { in: removed.map((t) => t.id) } },
      }),
      ...(teamName?.trim()
        ? [
            this.prisma.arenaTeam.update({
              where: { id: survivor.id },
              data: { name: teamName.trim() },
            }),
          ]
        : []),
    ]);

    const allTeams = await this.getTeamsFlat(sessionId);
    const survivorFresh = allTeams.find((t) => t.id === survivor.id)!;

    return {
      team: survivorFresh,
      removedTeamIds: removed.map((t) => t.id),
      allTeams,
    };
  }

  async startSession(sessionId: string) {
    const session = await this.prisma.arenaSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: {
        teams: { include: { members: true } },
        rounds: { orderBy: { order: 'asc' } },
      },
    });
    if (session.status !== ArenaStatus.LOBBY)
      throw new BadRequestException('Phiên không ở trạng thái LOBBY');
    // Đội đặt trước có thể còn 0 người — chỉ tính đội đã có người tham gia
    const teamsWithMembers = session.teams.filter((t) => t.members.length > 0);
    if (teamsWithMembers.length < 2)
      throw new BadRequestException('Cần ít nhất 2 đội có người chơi để bắt đầu');
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

  async recordAnswer(
    arenaRoundId: string,
    teamId: string,
    selectedOptionIds: string[],
    userId: string,
  ) {
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

    // Check team belongs to session và phải là thành viên đội mới được trả lời thay đội
    // (đội nhiều người: bất kỳ ai trong đội bấm trước cũng tính là câu trả lời chung)
    const team = await this.prisma.arenaTeam.findFirst({
      where: { id: teamId, arenaSessionId: round.arenaSessionId },
    });
    if (!team) throw new BadRequestException('Đội không thuộc phiên này');
    const membership = await this.prisma.arenaTeamMember.findFirst({
      where: { arenaTeamId: teamId, userId },
    });
    if (!membership) throw new BadRequestException('Bạn không thuộc đội này');

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
    const isCorrect =
      JSON.stringify(correctOptionIds) === JSON.stringify(selectedSorted);

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
      correctOptionIds: round.question.options
        .filter((o) => o.isCorrect)
        .map((o) => o.id),
      explanation: round.question.explanation,
      buzzes: [...correctBuzzes, ...wrongBuzzes].map((b) => ({
        teamId: b.teamId,
        isCorrect: b.isCorrect,
        pointsAwarded: b.isCorrect
          ? (pointsForRank[correctBuzzes.indexOf(b)] ??
            pointsForRank[pointsForRank.length - 1])
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
      include: { members: true },
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

    // Cộng XP + thăng bậc (dùng chung hệ Gamification với làm bài quiz)
    const xpResults: Record<
      string,
      {
        levelUp: boolean;
        newLevel: number;
        newBadges: { code: string; name: string; iconSlug: string }[];
      }
    > = {};
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      const rank = i + 1;
      const isWinner = rank === 1;

      // Đội nhiều người: mỗi thành viên đều nhận XP tham gia/thắng như nhau
      for (const member of team.members) {
        const userId = member.userId;
        await this.gamification.updateActivity(userId);
        if (isWinner) await this.gamification.incrementArenaWins(userId);

        const participateResult = await this.gamification.awardXp(
          userId,
          10,
          XpSource.ARENA_PARTICIPATE,
          sessionId,
          `Tham gia Arena, hạng ${rank}`,
        );
        const winResult = isWinner
          ? await this.gamification.awardXp(
              userId,
              30,
              XpSource.ARENA_WIN,
              sessionId,
              'Vô địch Arena',
            )
          : null;

        xpResults[userId] = {
          levelUp: participateResult.levelUp || (winResult?.levelUp ?? false),
          newLevel: Math.max(
            participateResult.newLevel,
            winResult?.newLevel ?? 0,
          ),
          newBadges: [
            ...participateResult.newBadges,
            ...(winResult?.newBadges ?? []),
          ],
        };
      }
    }

    return {
      type: 'ended',
      ranking: teams.map((t, i) => ({ ...t, rank: i + 1 })),
      xpResults,
    };
  }
}
