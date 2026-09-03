import { Module } from '@nestjs/common';
import { ArenaService } from './arena.service';
import { ArenaGateway } from './arena.gateway';
import { ArenaController } from './arena.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GamificationModule } from '../gamification/gamification.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, PrismaModule, GamificationModule],
  controllers: [ArenaController],
  providers: [ArenaService, ArenaGateway],
})
export class ArenaModule {}
