import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { XpSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ArenaService } from '../arena/arena.service';
import { ArenaHostModeDto } from '../arena/dto/create-arena.dto';
import { GamificationService } from '../gamification/gamification.service';

function isPowerOfTwo(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0;
}

// Thưởng XP theo THÀNH TÍCH CHUNG CUỘC của cả giải — cộng THÊM vào
// ARENA_PARTICIPATE/ARENA_WIN đã cộng qua từng trận trong giải, chỉ cộng 1
// lần khi Tournament chuyển FINISHED. MVP không tổ chức trận tranh hạng Ba
// (giữ đúng tinh thần đơn giản như luật bốc thăm hiện tại — không có "bye"),
// nên 2 đội thua bán kết đồng hạng Ba, cùng mức thưởng.
const XP_TOURNAMENT_CHAMPION = 100;
const XP_TOURNAMENT_RUNNER_UP = 50;
const XP_TOURNAMENT_THIRD_PLACE = 30;
const XP_TOURNAMENT_CONSOLATION = 15;

@Injectable()
export class TournamentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly arenaService: ArenaService,
    private readonly gamification: GamificationService,
  ) {}

  list() {
    return this.prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        quiz: { select: { title: true } },
        teams: true,
        matches: { orderBy: [{ round: 'asc' }, { orderInRound: 'asc' }] },
      },
    });
  }

  async getDetail(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        quiz: { select: { title: true } },
        teams: true,
        matches: { orderBy: [{ round: 'asc' }, { orderInRound: 'asc' }] },
      },
    });
    if (!tournament) throw new NotFoundException('Giải đấu không tồn tại');
    return tournament;
  }

  // Yêu cầu số đội là luỹ thừa của 2 (2/4/8/16...) để bốc thăm loại trực tiếp
  // không cần đội "bye" (miễn thi đấu vòng đầu) — giữ MVP đơn giản, admin tự
  // điều chỉnh số đội đăng ký cho tròn.
  async create(data: { name: string; quizId: string; teamNames: string[] }) {
    const names = [
      ...new Set(data.teamNames.map((n) => n.trim()).filter(Boolean)),
    ];
    if (!isPowerOfTwo(names.length)) {
      throw new BadRequestException(
        `Số đội phải là luỹ thừa của 2 (2, 4, 8, 16...) — hiện có ${names.length} đội hợp lệ`,
      );
    }

    const totalRounds = Math.log2(names.length);

    return this.prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.create({
        data: {
          name: data.name,
          quizId: data.quizId,
          status: 'RUNNING',
          totalRounds,
          currentRound: 1,
        },
      });

      const teams = await Promise.all(
        names.map((name, idx) =>
          tx.tournamentTeam.create({
            data: { tournamentId: tournament.id, name, seed: idx + 1 },
          }),
        ),
      );

      // Vòng 1: ghép lần lượt theo hạt giống 1v2, 3v4, ... — đã đủ 2 đội nên READY ngay.
      for (let i = 0; i < teams.length; i += 2) {
        await tx.tournamentMatch.create({
          data: {
            tournamentId: tournament.id,
            round: 1,
            orderInRound: i / 2,
            team1Id: teams[i].id,
            team2Id: teams[i + 1].id,
            status: 'READY',
          },
        });
      }

      // Các vòng sau: tạo sẵn khung trận rỗng (chờ đội thắng vòng trước tiến vào).
      let matchesInRound = teams.length / 2;
      for (let round = 2; round <= totalRounds; round++) {
        matchesInRound = matchesInRound / 2;
        for (let order = 0; order < matchesInRound; order++) {
          await tx.tournamentMatch.create({
            data: { tournamentId: tournament.id, round, orderInRound: order },
          });
        }
      }

      return tx.tournament.findUniqueOrThrow({
        where: { id: tournament.id },
        include: {
          teams: true,
          matches: { orderBy: [{ round: 'asc' }, { orderInRound: 'asc' }] },
        },
      });
    });
  }

  // Tạo 1 ArenaSession với đúng 2 đội của trận này rồi gắn vào match — từ đây
  // trận đấu diễn ra HOÀN TOÀN qua cỗ máy Đấu trường có sẵn (MC vào /manage/arena
  // vận hành như 1 phiên bình thường), module này không biết gì về buzz/reveal.
  async startMatch(matchId: string) {
    const match = await this.prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });
    if (!match) throw new NotFoundException('Trận đấu không tồn tại');
    if (match.status !== 'READY')
      throw new BadRequestException(
        'Trận đấu chưa đủ 2 đội hoặc đã bắt đầu/kết thúc',
      );

    const teams = await this.prisma.tournamentTeam.findMany({
      where: { id: { in: [match.team1Id!, match.team2Id!] } },
    });
    const team1 = teams.find((t) => t.id === match.team1Id);
    const team2 = teams.find((t) => t.id === match.team2Id);
    if (!team1 || !team2)
      throw new BadRequestException('Không xác định được 2 đội của trận đấu');

    const session = await this.arenaService.createSession({
      name: `${match.tournament.name} — Vòng ${match.round} — Trận ${match.orderInRound + 1}`,
      quizId: match.tournament.quizId,
      hostMode: ArenaHostModeDto.MANUAL,
      presetTeamNames: [team1.name, team2.name],
    });

    await this.prisma.tournamentMatch.update({
      where: { id: matchId },
      data: { arenaSessionId: session.id, status: 'RUNNING' },
    });

    return { arenaSessionId: session.id, joinCode: session.joinCode };
  }

  // Đọc kết quả ArenaSession đã FINISHED để xác định đội thắng (rank=1), loại
  // đội thua, và đẩy đội thắng vào đúng ô của trận vòng kế tiếp.
  async completeMatch(matchId: string) {
    const match = await this.prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });
    if (!match) throw new NotFoundException('Trận đấu không tồn tại');
    if (match.status !== 'RUNNING' || !match.arenaSessionId)
      throw new BadRequestException('Trận đấu chưa được bắt đầu');

    const session = await this.arenaService.getSessionDetail(
      match.arenaSessionId,
    );
    if (session.status !== 'FINISHED')
      throw new BadRequestException(
        'Phiên Đấu trường của trận này chưa kết thúc',
      );

    const winnerRow = (
      session.teams as { id: string; name: string; rank: number | null }[]
    ).find((t) => t.rank === 1);
    if (!winnerRow)
      throw new BadRequestException(
        'Phiên Đấu trường chưa xác định được đội thắng (chưa xếp hạng)',
      );

    const teams = await this.prisma.tournamentTeam.findMany({
      where: { id: { in: [match.team1Id!, match.team2Id!] } },
    });
    const winner = teams.find((t) => t.name === winnerRow.name);
    if (!winner)
      throw new BadRequestException(
        'Không khớp được đội thắng của phiên Đấu trường với đội trong giải đấu',
      );
    const loser = teams.find((t) => t.id !== winner.id)!;

    const justFinished = await this.prisma.$transaction(async (tx) => {
      await tx.tournamentMatch.update({
        where: { id: matchId },
        data: { winnerTeamId: winner.id, status: 'DONE' },
      });
      await tx.tournamentTeam.update({
        where: { id: loser.id },
        data: { isEliminated: true, eliminatedAtRound: match.round },
      });

      const nextRound = match.round + 1;
      if (nextRound > match.tournament.totalRounds) {
        await tx.tournament.update({
          where: { id: match.tournamentId },
          data: { status: 'FINISHED', championTeamId: winner.id },
        });
        return true;
      }

      const nextOrderInRound = Math.floor(match.orderInRound / 2);
      const nextMatch = await tx.tournamentMatch.findUniqueOrThrow({
        where: {
          tournamentId_round_orderInRound: {
            tournamentId: match.tournamentId,
            round: nextRound,
            orderInRound: nextOrderInRound,
          },
        },
      });
      const slot = match.orderInRound % 2 === 0 ? 'team1Id' : 'team2Id';
      const updatedSlots = { ...nextMatch, [slot]: winner.id };
      const bothReady = Boolean(updatedSlots.team1Id && updatedSlots.team2Id);

      await tx.tournamentMatch.update({
        where: { id: nextMatch.id },
        data: {
          [slot]: winner.id,
          status: bothReady ? 'READY' : 'PENDING',
        },
      });
      await tx.tournament.update({
        where: { id: match.tournamentId },
        data: { currentRound: nextRound },
      });
      return false;
    });

    // Cộng XP thưởng theo hạng chung cuộc SAU khi transaction đã commit (theo
    // đúng cách endSession() của Arena làm — awardXp là chuỗi query riêng,
    // không lồng trong $transaction). completeMatch() không gọi lại được lần
    // 2 cho cùng 1 trận (guard status !== 'RUNNING' ở đầu hàm ném lỗi ngay),
    // nên tournament chỉ chuyển FINISHED đúng 1 lần — không cần cờ chống trùng.
    if (justFinished) {
      await this.awardTournamentPrizes(match.tournamentId);
    }

    return this.getDetail(match.tournamentId);
  }

  // Thưởng theo THÀNH TÍCH CHUNG CUỘC của cả giải (khác với XP từng trận đã
  // cộng qua Arena): Vô địch / Á quân / đồng hạng Ba (2 đội, MVP không tổ
  // chức trận tranh hạng Ba) / Khuyến khích (mọi đội loại sớm hơn bán kết).
  // Mỗi đội có thể đổi thành viên giữa các vòng (ai rảnh thì vào), nên lấy
  // đúng người CÓ MẶT ở trận mà đội đó dừng lại — không cộng cho người từng
  // khoác áo đội này nhưng vắng mặt trận quyết định.
  private async awardTournamentPrizes(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      include: { teams: true, matches: true },
    });
    const semifinalRound = tournament.totalRounds - 1;

    for (const team of tournament.teams) {
      let source: XpSource;
      let amount: number;
      let noteLabel: string;
      let decidingRound: number;

      if (team.id === tournament.championTeamId) {
        source = XpSource.TOURNAMENT_CHAMPION;
        amount = XP_TOURNAMENT_CHAMPION;
        noteLabel = 'Vô địch';
        decidingRound = tournament.totalRounds;
      } else if (team.eliminatedAtRound === tournament.totalRounds) {
        source = XpSource.TOURNAMENT_RUNNER_UP;
        amount = XP_TOURNAMENT_RUNNER_UP;
        noteLabel = 'Á quân';
        decidingRound = team.eliminatedAtRound;
      } else if (
        semifinalRound >= 1 &&
        team.eliminatedAtRound === semifinalRound
      ) {
        source = XpSource.TOURNAMENT_THIRD_PLACE;
        amount = XP_TOURNAMENT_THIRD_PLACE;
        noteLabel = 'Đồng hạng Ba';
        decidingRound = team.eliminatedAtRound;
      } else if (
        team.eliminatedAtRound != null &&
        team.eliminatedAtRound < semifinalRound
      ) {
        source = XpSource.TOURNAMENT_CONSOLATION;
        amount = XP_TOURNAMENT_CONSOLATION;
        noteLabel = 'Giải khuyến khích';
        decidingRound = team.eliminatedAtRound;
      } else {
        continue; // đội chưa từng vào trận nào hợp lệ (không nên xảy ra)
      }

      const decidingMatch = tournament.matches.find(
        (m) =>
          m.round === decidingRound &&
          (m.team1Id === team.id || m.team2Id === team.id),
      );
      if (!decidingMatch?.arenaSessionId) continue;

      const arenaTeam = await this.prisma.arenaTeam.findFirst({
        where: {
          arenaSessionId: decidingMatch.arenaSessionId,
          name: team.name,
        },
        include: { members: true },
      });
      if (!arenaTeam) continue;

      for (const member of arenaTeam.members) {
        await this.gamification.awardXp(
          member.userId,
          amount,
          source,
          tournamentId,
          `${noteLabel} giải đấu "${tournament.name}"`,
        );
      }
    }
  }

  async delete(id: string) {
    await this.prisma.tournament.delete({ where: { id } });
    return { deleted: true };
  }
}
