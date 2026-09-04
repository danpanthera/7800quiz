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
        // Lần làm bài gần nhất của chính user — để trang chủ hiện đúng trạng thái
        // (chưa làm / đang làm dở / đã hết giờ / đã nộp) thay vì lúc nào cũng "Bắt đầu"
        attempts: {
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            deadlineAt: true,
            submissionId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Giữ nguyên toàn bộ field cũ, chỉ thêm myAttempt để không phá client đang dùng
    return assignments.map(({ attempts, ...rest }) => ({
      ...rest,
      myAttempt: attempts[0] ?? null,
    }));
  }
}
