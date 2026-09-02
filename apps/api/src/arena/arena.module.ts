import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ArenaService } from './arena.service';
import { ArenaGateway } from './arena.gateway';
import { ArenaController } from './arena.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    PrismaModule,
    GamificationModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  controllers: [ArenaController],
  providers: [ArenaService, ArenaGateway],
})
export class ArenaModule {}
