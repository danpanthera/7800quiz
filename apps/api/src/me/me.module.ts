import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [MeController],
})
export class MeModule {}
