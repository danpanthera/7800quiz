import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncService } from './sync.service';
import { SyncPushDto } from './dto/sync-push.dto';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  // App đẩy hàng đợi lên server
  @Post('push')
  push(@Request() req: { user: { id: string } }, @Body() dto: SyncPushDto) {
    return this.syncService.push(req.user.id, dto);
  }

  // App kéo cập nhật về (kết quả, trạng thái) từ lần sync cuối
  @Get('pull')
  pull(
    @Request() req: { user: { id: string } },
    @Query('since') since: string,
  ) {
    return this.syncService.pull(req.user.id, since);
  }
}
