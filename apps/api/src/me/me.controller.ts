import { Body, Controller, Put, Request, UseGuards } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from '../notifications/notifications.service';

class FcmTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private notificationsService: NotificationsService) {}

  @Put('fcm-token')
  async updateFcmToken(
    @Request() req: { user: { id: string } },
    @Body() dto: FcmTokenDto,
  ) {
    await this.notificationsService.saveFcmToken(req.user.id, dto.token);
    return { ok: true };
  }
}
