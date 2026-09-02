import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ArenaService } from './arena.service';
import { CreateArenaDto } from './dto/create-arena.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller()
export class ArenaController {
  constructor(private arenaService: ArenaService) {}

  // ─── Admin endpoints (require JWT) ──────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('admin/arena-sessions')
  create(@Body() dto: CreateArenaDto) {
    return this.arenaService.createSession(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/arena-sessions')
  list() {
    return this.arenaService.listSessions();
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/arena-sessions/:id')
  detail(@Param('id') id: string) {
    return this.arenaService.getSessionDetail(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admin/arena-sessions/:id')
  remove(@Param('id') id: string) {
    return this.arenaService.deleteSession(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/arena-sessions/:id/cancel')
  cancel(@Param('id') id: string) {
    return this.arenaService.cancelSession(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/arena-sessions/:id/stop')
  stop(@Param('id') id: string) {
    return this.arenaService.stopSession(id);
  }

  // ─── Public endpoint — Flutter dùng để lấy session info qua joinCode ────

  @Get('arena/join/:joinCode')
  joinInfo(@Param('joinCode') joinCode: string) {
    return this.arenaService.getSessionByJoinCode(joinCode.toUpperCase());
  }
}
