import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncPushDto } from './dto/sync-push.dto';

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async push(userId: string, dto: SyncPushDto) {
    // Xác nhận các submission đã tồn tại và thuộc user này
    const submissions = await this.prisma.submission.findMany({
      where: {
        id: { in: dto.submissionIds },
        userId,
      },
      select: { id: true, status: true, score: true, syncedAt: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'SYNC',
        meta: { submissionIds: dto.submissionIds, count: submissions.length },
      },
    });

    return {
      acknowledged: submissions.map((s) => ({
        id: s.id,
        status: s.status,
        score: s.score,
        syncedAt: s.syncedAt,
      })),
    };
  }

  async pull(userId: string, since?: string) {
    const sinceDate = since ? new Date(since) : new Date(0);

    const submissions = await this.prisma.submission.findMany({
      where: {
        userId,
        syncedAt: { gte: sinceDate },
      },
      select: {
        id: true,
        quizId: true,
        status: true,
        score: true,
        isPassed: true,
        submittedAt: true,
        syncedAt: true,
      },
      orderBy: { syncedAt: 'asc' },
    });

    return { submissions, pulledAt: new Date().toISOString() };
  }
}
