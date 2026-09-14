import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GamificationModule } from '../gamification/gamification.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    GamificationModule,
    MailModule,
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
