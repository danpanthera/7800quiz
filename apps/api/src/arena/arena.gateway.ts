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

  private extractAdminUser(client: Socket): { userId: string; role: string } | null {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization as string)?.replace('Bearer ', '');
      if (!token) return null;
      const payload = this.jwtService.verify(token) as { sub: string; role: string };
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
    const admin = this.extractAdminUser(client);
    if (!admin || admin.role !== 'ADMIN') {
      return { error: 'Không có quyền điều hành' };
    }
    client.join(this.getRoomName(data.sessionId));
    client.data.sessionId = data.sessionId;
    client.data.isHost = true;
    return { ok: true, sessionId: data.sessionId };
  }

  // ─── Mobile: join a team ──────────────────────────────────────────────────

  @SubscribeMessage('arena.join')
  async handleJoin(
    @MessageBody() data: { joinCode: string; teamName: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { session, team } = await this.arenaService.joinTeam(data.joinCode, data.teamName);
      client.join(this.getRoomName(session.id));
      client.data.sessionId = session.id;
      client.data.teamId = team.id;

      // Broadcast new team to everyone in room
      this.server.to(this.getRoomName(session.id)).emit('arena.team_joined', {
        team: { id: team.id, name: team.name, color: team.color },
      });

      // Send private confirmation back to joining client with their teamId
      client.emit('arena.joined_you', {
        teamId: team.id,
        teamColor: team.color,
        sessionId: session.id,
      });

      return { ok: true, teamId: team.id, sessionId: session.id, teamColor: team.color };
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
    const admin = this.extractAdminUser(client);
    if (!admin || admin.role !== 'ADMIN') return { error: 'Không có quyền' };
    try {
      const questionData = await this.arenaService.startSession(data.sessionId);
      this.server.to(this.getRoomName(data.sessionId)).emit('arena.started', {});
      this.server.to(this.getRoomName(data.sessionId)).emit('arena.question', questionData);
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  // ─── Mobile: submit answer ────────────────────────────────────────────────

  @SubscribeMessage('arena.answer')
  async handleAnswer(
    @MessageBody()
    data: { arenaRoundId: string; teamId: string; selectedOptionIds: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const result = await this.arenaService.recordAnswer(
        data.arenaRoundId,
        data.teamId,
        data.selectedOptionIds,
      );
      // Notify everyone that a team has buzzed (no correct/wrong revealed yet)
      const sessionId = client.data.sessionId as string;
      this.server.to(this.getRoomName(sessionId)).emit('arena.buzz_in', {
        teamId: result.buzz.teamId,
        teamName: result.teamName,
        teamColor: result.teamColor,
      });
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
    const admin = this.extractAdminUser(client);
    if (!admin || admin.role !== 'ADMIN') return { error: 'Không có quyền' };
    try {
      const revealData = await this.arenaService.revealRound(data.sessionId);
      this.server.to(this.getRoomName(data.sessionId)).emit('arena.revealed', revealData);
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
    const admin = this.extractAdminUser(client);
    if (!admin || admin.role !== 'ADMIN') return { error: 'Không có quyền' };
    try {
      const result = await this.arenaService.nextQuestion(data.sessionId);
      if (result.type === 'ended') {
        this.server.to(this.getRoomName(data.sessionId)).emit('arena.ended', result);
      } else {
        this.server.to(this.getRoomName(data.sessionId)).emit('arena.question', result);
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
    const admin = this.extractAdminUser(client);
    if (!admin || admin.role !== 'ADMIN') return { error: 'Không có quyền' };
    try {
      const result = await this.arenaService.endSession(data.sessionId);
      this.server.to(this.getRoomName(data.sessionId)).emit('arena.ended', result);
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  }
}
