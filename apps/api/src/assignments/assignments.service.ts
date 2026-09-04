import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true, username: true },
    });

    if (!user) throw new NotFoundException('Người dùng không tồn tại');

    // Tìm canBoId của user: ưu tiên userAD, fallback cbCode và username
    const canBo = user.username
      ? await this.prisma.canBo.findFirst({
          where: {
            isActive: true,
            OR: [
              { userAD: user.username },
              { cbCode: user.username },
              { username: user.username },
            ],
          },
          select: { id: true },
        })
      : null;

    const now = new Date();
    const assignments = await this.prisma.assignment.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { userId },
          { canBoId: canBo?.id ?? undefined },
          { departmentId: user.departmentId ?? undefined },
        ],
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            description: true,
            topic: true,
            durationMin: true,
            instantFeedback: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return assignments;
  }
}
