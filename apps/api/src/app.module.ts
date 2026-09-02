import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { QuizModule } from './quiz/quiz.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { SyncModule } from './sync/sync.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MeModule } from './me/me.module';
import { ArenaModule } from './arena/arena.module';
import { GamificationModule } from './gamification/gamification.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    QuizModule,
    AssignmentsModule,
    SubmissionsModule,
    SyncModule,
    AdminModule,
    NotificationsModule,
    MeModule,
    ArenaModule,
    GamificationModule,
  ],
})
export class AppModule {}
