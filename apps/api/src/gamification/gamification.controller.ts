import {
  Controller, Get, Post, Put, Delete, Param, Body, Query, Request, UseGuards, BadRequestException,
} from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller()
export class GamificationController {
  constructor(private svc: GamificationService) {}

  // ─── /me routes ──────────────────────────────────────────────────────────

  @Get('me/progress')
  @UseGuards(JwtAuthGuard)
  getProgress(@Request() req: { user: { id: string } }) {
    return this.svc.getProgress(req.user.id);
  }

  @Get('me/badges')
  @UseGuards(JwtAuthGuard)
  getBadges(@Request() req: { user: { id: string } }) {
    return this.svc.getBadges(req.user.id);
  }

  @Get('me/xp-history')
  @UseGuards(JwtAuthGuard)
  getXpHistory(
    @Request() req: { user: { id: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getXpHistory(req.user.id, page ? +page : 1, limit ? +limit : 20);
  }

  // ─── /admin routes ────────────────────────────────────────────────────────

  @Get('admin/leaderboard')
  @UseGuards(JwtAuthGuard)
  getLeaderboard(
    @Query('period') period?: 'all' | 'month' | 'week',
    @Query('departmentId') departmentId?: string,
  ) {
    return this.svc.getLeaderboard(period ?? 'all', departmentId);
  }

  @Get('admin/badge-stats')
  @UseGuards(JwtAuthGuard)
  getBadgeStats() {
    return this.svc.getBadgeStats();
  }

  @Get('admin/levels')
  @UseGuards(JwtAuthGuard)
  getLevels() {
    return this.svc.getLevels();
  }

  @Post('admin/levels')
  @UseGuards(JwtAuthGuard)
  createLevel(@Body() body: { level: number; name: string; minXp: number; color: string; iconSlug?: string }) {
    return this.svc.createLevel(body);
  }

  @Put('admin/levels/:id')
  @UseGuards(JwtAuthGuard)
  updateLevel(
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; minXp: number; color: string; iconSlug: string }>,
  ) {
    return this.svc.updateLevel(id, body);
  }

  @Delete('admin/levels/:id')
  @UseGuards(JwtAuthGuard)
  async deleteLevel(@Param('id') id: string) {
    try {
      return await this.svc.deleteLevel(id);
    } catch (e: unknown) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Không thể xóa cấp độ này');
    }
  }
}
