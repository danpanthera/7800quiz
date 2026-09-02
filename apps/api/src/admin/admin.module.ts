import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule, MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } })],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
