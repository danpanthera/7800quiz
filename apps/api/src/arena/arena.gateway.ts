import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ArenaService } from './arena.service';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';

const ARENA_HOST_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.TRAINER];

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class ArenaGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private arenaService: ArenaService,
    private jwtService: JwtService,
  ) {}

  handleConnection(client: Socket) {
    // Connection tracked implicitly via rooms
  }

  handleDisconnect(client: Socket) {
    // Clean up if needed
  }

  private getRoomName(sessionId: string) {
    return `arena-${sessionId}`;
  }

  // Room riêng cho từng đội — dùng để gửi sự kiện chung cho cả đội (vd: đồng
  // đội đã trả lời, cả đội bị kick, cả đội vừa được gộp vào)
  private getTeamRoomName(teamId: string) {
    return `arena-team-${teamId}`;
  }

  // Room riêng cho từng user — dùng để gửi sự kiện CHỈ đúng 1 người (vd: bị
  // gỡ khỏi đội, được chuyển sang đội khác) mà không ảnh hưởng đồng đội còn lại
  private getUserRoomName(userId: string) {
    return `arena-user-${userId}`;
  }

  private extractUser(
    client: Socket,
  ): { userId: string; role: UserRole } | null {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization as string)?.replace(
          'Bearer ',
          '',
        );
      if (!token) return null;
      const payload = this.jwtService.verify(token);
      return { userId: payload.sub, role: payload.role };
    } catch {
      return null;
    }
  }

  // ─── Admin: host a session ────────────────────────────────────────────────

  @SubscribeMessage('arena.host')
  async handleHost(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const host = this.extractUser(client);
    if (!host || !ARENA_HOST_ROLES.includes(host.role)) {
      return { error: 'Không có quyền điều hành' };
    }
    client.join(this.getRoomName(data.sessionId));
    client.data.sessionId = data.sessionId;
    client.data.isHost = true;
    return { ok: true, sessionId: data.sessionId };
  }

  // ─── Người chơi: tham gia đội (bắt buộc đăng nhập) ─────────────────────────

  @SubscribeMessage('arena.join')
  async handleJoin(
    @MessageBody()
    data: {
      joinCode: string;
      teamName?: string;
      teamId?: string;
      passcode?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const player = this.extractUser(client);
    if (!player) return { error: 'Cần đăng nhập để tham gia Arena' };
    try {
      const { session, team } = await this.arenaService.joinTeam(
        data.joinCode,
        player.userId,
        {
          teamName: data.teamName,
          teamId: data.teamId,
          passcode: data.passcode,
        },
      );
      client.join(this.getRoomName(session.id));
      client.join(this.getTeamRoomName(team.id));
      client.join(this.getUserRoomName(player.userId));
      client.data.sessionId = session.id;
      client.data.teamId = team.id;
      client.data.userId = player.userId;

      // Broadcast new team to everyone in room
      this.server.to(this.getRoomName(session.id)).emit('arena.team_joined', {
        team: {
          id: team.id,
          name: team.name,
          color: team.color,
          members: team.members.map((m) => ({
            userId: m.userId,
            fullName: m.user.fullName,
          })),
        },
      });

      // Send private confirmation back to joining client with their teamId
      client.emit('arena.joined_you', {
        teamId: team.id,
        teamColor: team.color,
        sessionId: session.id,
      });

      return {
        ok: true,
        teamId: team.id,
        teamName: team.name,
        sessionId: session.id,
        teamColor: team.color,
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  // ─── Admin: start session ─────────────────────────────────────────────────

  @SubscribeMessage('arena.start')
  async handleStart(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const host = this.extractUser(client);
    if (!host || !ARENA_HOST_ROLES.includes(host.role))
      return { error: 'Không có quyền' };
    try {
      const questionData = await this.arenaService.startSession(data.sessionId);
      this.server
        .to(this.getRoomName(data.sessionId))
        .emit('arena.started', {});
      this.server
        .to(this.getRoomName(data.sessionId))
        .emit('arena.question', questionData);
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  // ─── Admin: mời một đội ra khỏi phòng (kick) ────────────────────────────────

  @SubscribeMessage('arena.kick')
  async handleKick(
    @MessageBody() data: { sessionId: string; teamId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const host = this.extractUser(client);
    if (!host || !ARENA_HOST_ROLES.includes(host.role))
      return { error: 'Không có quyền' };
    try {
      const result = await this.arenaService.kickTeam(
        data.sessionId,
        data.teamId,
      );
      // Báo riêng cho cả đội bị kick (tất cả thành viên) để họ tự thoát khỏi phòng
      this.server
        .to(this.getTeamRoomName(data.teamId))
        .emit('arena.you_were_kicked', { teamName: result.teamName });
      // Báo cho cả phòng (host + các đội khác) để cập nhật danh sách
      this.server
        .to(this.getRoomName(data.sessionId))
        .emit('arena.teams_updated', { teams: result.allTeams });
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  // ─── Admin: gỡ 1 người chơi cụ thể khỏi đội (đội nhiều người) ───────────────

  @SubscribeMessage('arena.kick_member')
  async handleKickMember(
    @MessageBody() data: { sessionId: string; teamId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const host = this.extractUser(client);
    if (!host || !ARENA_HOST_ROLES.includes(host.role))
      return { error: 'Không có quyền' };
    try {
      const result = await this.arenaService.kickMember(
        data.sessionId,
        data.teamId,
        data.userId,
      );
      // Chỉ báo riêng đúng người bị gỡ — không ảnh hưởng đồng đội còn lại
      this.server
        .to(this.getUserRoomName(data.userId))
        .emit('arena.you_were_kicked', { teamName: undefined });
      this.server
        .to(this.getRoomName(data.sessionId))
        .emit('arena.teams_updated', { teams: result.allTeams });
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  // ─── Admin: chuyển 1 người chơi sang đội khác ───────────────────────────────

  @SubscribeMessage('arena.move_member')
  async handleMoveMember(
    @MessageBody()
    data: { sessionId: string; userId: string; targetTeamId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const host = this.extractUser(client);
    if (!host || !ARENA_HOST_ROLES.includes(host.role))
      return { error: 'Không có quyền' };
    try {
      const result = await this.arenaService.moveMember(
        data.sessionId,
        data.userId,
        data.targetTeamId,
      );
      const userRoom = this.getUserRoomName(data.userId);
      // Di chuyển đúng socket của người này sang room đội mới, rời room đội cũ
      await this.server.in(userRoom).socketsJoin(this.getTeamRoomName(data.targetTeamId));
      if (result.sourceTeamId) {
        await this.server
          .in(userRoom)
          .socketsLeave(this.getTeamRoomName(result.sourceTeamId));
      }
      this.server.to(userRoom).emit('arena.you_were_moved', {
        teamId: result.targetTeamId,
        teamName: result.targetTeamName,
        teamColor: result.targetTeamColor,
      });
      this.server
        .to(this.getRoomName(data.sessionId))
        .emit('arena.teams_updated', { teams: result.allTeams });
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  // ─── Admin: gộp 2-5 người chơi thành 1 đội ──────────────────────────────────

  @SubscribeMessage('arena.merge')
  async handleMerge(
    @MessageBody()
    data: { sessionId: string; teamIds: string[]; teamName?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const host = this.extractUser(client);
    if (!host || !ARENA_HOST_ROLES.includes(host.role))
      return { error: 'Không có quyền' };
    try {
      const result = await this.arenaService.mergeTeams(
        data.sessionId,
        data.teamIds,
        data.teamName,
      );
      const survivorRoom = this.getTeamRoomName(result.team.id);
      // Di chuyển toàn bộ socket của các đội bị gộp sang room của đội sống sót
      // để họ tiếp tục nhận đúng sự kiện riêng (bị kick, đồng đội đã trả lời...)
      for (const removedId of result.removedTeamIds) {
        await this.server
          .in(this.getTeamRoomName(removedId))
          .socketsJoin(survivorRoom);
      }
      this.server.to(survivorRoom).emit('arena.you_were_merged', {
        teamId: result.team.id,
        teamName: result.team.name,
        teamColor: result.team.color,
      });
      this.server
        .to(this.getRoomName(data.sessionId))
        .emit('arena.teams_updated', { teams: result.allTeams });
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  // ─── Người chơi: nộp đáp án (buzz-in) ───────────────────────────────────────

  @SubscribeMessage('arena.answer')
  async handleAnswer(
    @MessageBody()
    data: { arenaRoundId: string; teamId: string; selectedOptionIds: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return { error: 'Cần tham gia đội trước khi trả lời' };
    try {
      const result = await this.arenaService.recordAnswer(
        data.arenaRoundId,
        data.teamId,
        data.selectedOptionIds,
        userId,
      );
      // Notify everyone that a team has buzzed (no correct/wrong revealed yet)
      const sessionId = client.data.sessionId as string;
      this.server.to(this.getRoomName(sessionId)).emit('arena.buzz_in', {
        teamId: result.buzz.teamId,
        teamName: result.teamName,
        teamColor: result.teamColor,
      });
      // Đội nhiều người: báo riêng cho các đồng đội còn lại là đội đã trả lời
      // rồi (tránh họ vẫn thấy màn hình đang chờ chọn đáp án)
      this.server
        .to(this.getTeamRoomName(data.teamId))
        .emit('arena.team_answered', {});
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  // ─── Admin: reveal answer ─────────────────────────────────────────────────

  @SubscribeMessage('arena.reveal')
  async handleReveal(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const host = this.extractUser(client);
    if (!host || !ARENA_HOST_ROLES.includes(host.role))
      return { error: 'Không có quyền' };
    try {
      const revealData = await this.arenaService.revealRound(data.sessionId);
      this.server
        .to(this.getRoomName(data.sessionId))
        .emit('arena.revealed', revealData);
      this.server
        .to(this.getRoomName(data.sessionId))
        .emit('arena.leaderboard', { teams: revealData.leaderboard });
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  // ─── Admin: next question ─────────────────────────────────────────────────

  @SubscribeMessage('arena.next')
  async handleNext(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const host = this.extractUser(client);
    if (!host || !ARENA_HOST_ROLES.includes(host.role))
      return { error: 'Không có quyền' };
    try {
      const result = await this.arenaService.nextQuestion(data.sessionId);
      if (result.type === 'ended') {
        this.server
          .to(this.getRoomName(data.sessionId))
          .emit('arena.ended', result);
      } else {
        this.server
          .to(this.getRoomName(data.sessionId))
          .emit('arena.question', result);
      }
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  // ─── Admin: end session early ─────────────────────────────────────────────

  @SubscribeMessage('arena.end')
  async handleEnd(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const host = this.extractUser(client);
    if (!host || !ARENA_HOST_ROLES.includes(host.role))
      return { error: 'Không có quyền' };
    try {
      const result = await this.arenaService.endSession(data.sessionId);
      this.server
        .to(this.getRoomName(data.sessionId))
        .emit('arena.ended', result);
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  }
}
