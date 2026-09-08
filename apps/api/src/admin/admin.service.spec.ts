import { AdminService } from './admin.service';

describe('AdminService.duplicateQuiz', () => {
  it('nhân bản đúng câu hỏi/đáp án, đặt bản sao ở trạng thái Tắt', async () => {
    const original = {
      id: 'quiz-1',
      title: 'Nghiệp vụ tín dụng',
      description: 'Mô tả gốc',
      topic: 'Tín dụng',
      durationMin: 30,
      passScore: 70,
      instantFeedback: false,
      maxAttempts: 2,
      isActive: true,
      questions: [
        {
          id: 'question-1',
          subjectId: 'subject-1',
          content: 'Câu 1',
          imageUrl: null,
          explanation: 'Giải thích',
          questionType: 'SINGLE',
          orderIndex: 1,
          points: 10,
          options: [
            { id: 'opt-1', content: 'Đúng', isCorrect: true, orderIndex: 1 },
            { id: 'opt-2', content: 'Sai', isCorrect: false, orderIndex: 2 },
          ],
        },
      ],
    };
    const prisma = {
      quiz: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(original),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'quiz-2', ...data }),
          ),
      },
    };
    const service = new AdminService(prisma as never, {} as never);

    await service.duplicateQuiz('quiz-1');

    expect(prisma.quiz.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Nghiệp vụ tín dụng (Bản sao)',
        durationMin: 30,
        passScore: 70,
        maxAttempts: 2,
        isActive: false,
        questions: {
          create: [
            expect.objectContaining({
              subjectId: 'subject-1',
              content: 'Câu 1',
              questionType: 'SINGLE',
              isBank: false,
              options: {
                create: [
                  { content: 'Đúng', isCorrect: true, orderIndex: 1 },
                  { content: 'Sai', isCorrect: false, orderIndex: 2 },
                ],
              },
            }),
          ],
        },
      }),
      include: { _count: { select: { assignments: true, questions: true } } },
    });
  });
});

describe('AdminService.deleteReportsBulk', () => {
  it('KHÔNG xóa AuditLog liên quan (nhật ký phải bất biến) và tự ghi log cho chính thao tác xóa', async () => {
    const prisma = {
      submission: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'sub-1', userId: 'user-1' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      quizAttempt: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      xpTransaction: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      submissionAnswer: {
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const gamification = {
      recomputeUserProgress: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AdminService(prisma as never, gamification as never);

    const result = await service.deleteReportsBulk(['sub-1'], 'admin-1');

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'admin-1',
        action: 'DELETE_REPORTS_BULK',
        meta: { submissionIds: ['sub-1'], count: 1 },
      },
    });
    expect(gamification.recomputeUserProgress).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ deleted: 1 });
  });
});

describe('AdminService.getAuditLogs', () => {
  it('lọc theo action/userId/khoảng ngày, ánh xạ đúng tên người dùng', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'log-1',
        userId: 'user-1',
        user: { fullName: 'Nguyễn Văn A', username: 'nguyenvana' },
        action: 'DELETE_CAN_BO',
        entityId: 'canbo-1',
        meta: null,
        ipAddress: null,
        createdAt: new Date('2026-09-08T00:00:00.000Z'),
      },
    ]);
    const prisma = { auditLog: { findMany } };
    const service = new AdminService(prisma as never, {} as never);

    const result = await service.getAuditLogs({
      action: 'DELETE_CAN_BO',
      userId: 'user-1',
      from: '2026-09-01',
      to: '2026-09-09',
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        action: 'DELETE_CAN_BO',
        userId: 'user-1',
        createdAt: { gte: new Date('2026-09-01'), lte: new Date('2026-09-09') },
      },
      include: { user: { select: { fullName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    expect(result).toEqual([
      {
        id: 'log-1',
        userId: 'user-1',
        userName: 'Nguyễn Văn A',
        username: 'nguyenvana',
        action: 'DELETE_CAN_BO',
        entityId: 'canbo-1',
        meta: null,
        ipAddress: null,
        createdAt: new Date('2026-09-08T00:00:00.000Z'),
      },
    ]);
  });

  it('không lọc gì → where rỗng, take mặc định 200', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { auditLog: { findMany } };
    const service = new AdminService(prisma as never, {} as never);

    await service.getAuditLogs();

    expect(findMany).toHaveBeenCalledWith({
      where: {},
      include: { user: { select: { fullName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  });
});

describe('AdminService — ghi nhật ký cho thao tác nhạy cảm với Cán bộ', () => {
  it('deleteCanBo ghi AuditLog action DELETE_CAN_BO kèm actorUserId', async () => {
    const prisma = {
      canBo: { delete: jest.fn().mockResolvedValue({ id: 'canbo-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new AdminService(prisma as never, {} as never);

    await service.deleteCanBo('canbo-1', 'admin-1');

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: { userId: 'admin-1', action: 'DELETE_CAN_BO', entityId: 'canbo-1' },
    });
  });

  it('bulkDeleteCanBo ghi AuditLog action DELETE_CAN_BO_BULK kèm danh sách id', async () => {
    const prisma = {
      canBo: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new AdminService(prisma as never, {} as never);

    const result = await service.bulkDeleteCanBo(['c1', 'c2'], 'admin-1');

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'admin-1',
        action: 'DELETE_CAN_BO_BULK',
        meta: { canBoIds: ['c1', 'c2'], deleted: 2 },
      },
    });
    expect(result).toEqual({ deleted: 2 });
  });

  it('resetCanBoPasswords ghi AuditLog action RESET_CAN_BO_PASSWORDS kèm thống kê', async () => {
    const prisma = {
      canBo: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'c1',
            cbCode: 'CB001',
            fullName: 'Nguyễn Văn A',
            userAD: null,
          },
        ]),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new AdminService(prisma as never, {} as never);

    await service.resetCanBoPasswords(['c1'], 'admin-1');

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'admin-1',
        action: 'RESET_CAN_BO_PASSWORDS',
        meta: { canBoIds: ['c1'], reset: 1, noAccount: 0 },
      },
    });
  });
});
