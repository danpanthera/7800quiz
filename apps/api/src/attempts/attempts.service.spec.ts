import { AttemptsService } from './attempts.service';
import { AttemptStatus, Prisma } from '@prisma/client';
import { Logger } from '@nestjs/common';

const attemptId = 'ad9d0b6e-482e-44f1-9c83-e24f9401855c';
const assignmentId = 'eb113a13-e77c-4a73-a693-3ae543492d20';

const snapshot = {
  quiz: {
    id: 'quiz-1',
    title: 'Bài kiểm tra nghiệp vụ',
    description: null,
    topic: 'Tín dụng',
    durationMin: 30,
    passScore: 70,
  },
  questions: [
    {
      id: 'question-1',
      content: 'Câu hỏi',
      questionType: 'SINGLE',
      orderIndex: 1,
      points: 10,
      explanation: 'Giải thích',
      subjectId: 'subject-1',
      subjectName: 'Tín dụng',
      options: [
        { id: 'option-1', content: 'Đúng', isCorrect: true, orderIndex: 1 },
        { id: 'option-2', content: 'Sai', isCorrect: false, orderIndex: 2 },
      ],
    },
  ],
};

// Snapshot "cũ" — tạo trước khi có tính năng hiển thị lĩnh vực, thiếu hẳn 2 key
// subjectId/subjectName (khác với câu đã phân loại nhưng subjectName: null).
const snapshotCuThieuLinhVuc = {
  ...snapshot,
  questions: [
    (() => {
      const { subjectId, subjectName, ...rest } = snapshot.questions[0];
      void subjectId;
      void subjectName;
      return rest;
    })(),
  ],
};

// Mô phỏng đúng bộ đề trong báo cáo của Sếp: các câu cùng lĩnh vực đứng liền
// khối (3 câu CNTT rồi mới tới 2 câu Kiến thức chung) — dùng để kiểm tra tính
// năng "Xáo trộn thứ tự câu hỏi khi thi" (Quiz.shuffleQuestions).
const snapshotNhieuCau = {
  quiz: snapshot.quiz,
  questions: ['cntt-1', 'cntt-2', 'cntt-3', 'kt-chung-1', 'kt-chung-2'].map(
    (id, i) => ({
      id,
      content: `Câu ${id}`,
      questionType: 'SINGLE',
      orderIndex: i + 1,
      points: 10,
      subjectId: id.startsWith('cntt') ? 'subject-cntt' : 'subject-kt-chung',
      subjectName: id.startsWith('cntt') ? 'CNTT' : 'Kiến thức chung',
      options: [
        { id: `${id}-a`, content: 'Đúng', isCorrect: true, orderIndex: 1 },
        { id: `${id}-b`, content: 'Sai', isCorrect: false, orderIndex: 2 },
      ],
    }),
  ),
};

// Cùng thuật toán với AttemptsService.stableShuffle()/hashString() (private,
// không gọi thẳng được từ test) — dùng để tính trước thứ tự kỳ vọng, tránh
// assertion đoán mò/không ổn định. Đổi thuật toán bên service thì sửa lại đây.
function stableShuffleGiongHetService<T extends { id: string }>(
  items: T[],
  seed: string,
): T[] {
  const hashString = (input: string): number => {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash * 31 + input.charCodeAt(i)) | 0;
    }
    return hash;
  };
  return items
    .map((item) => ({ item, key: hashString(seed + item.id) }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.item);
}

describe('AttemptsService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-03T08:00:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('tạo attempt với deadline do server quyết định và chỉ trả đề đã lọc đáp án', async () => {
    const prisma = {
      quizAttempt: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ ...data })),
      },
      quizVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'version-1',
          version: 1,
          snapshot,
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const assignments = {
      getForUser: jest
        .fn()
        .mockResolvedValue([
          { id: assignmentId, quizId: 'quiz-1', quiz: snapshot.quiz },
        ]),
    };
    const service = new AttemptsService(
      prisma as never,
      assignments as never,
      {} as never,
    );

    const result = await service.start('user-1', {
      id: attemptId,
      assignmentId,
    });

    expect(prisma.quizAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: attemptId,
        userId: 'user-1',
        assignmentId,
        quizId: 'quiz-1',
        quizVersionId: 'version-1',
        startedAt: new Date('2026-09-03T08:00:00.000Z'),
        deadlineAt: new Date('2026-09-03T08:30:00.000Z'),
      }),
    });
    expect(result.quiz.questions[0].options[0]).not.toHaveProperty('isCorrect');
    expect(result.quiz.questions[0]).not.toHaveProperty('explanation');
    expect(result.quiz.questions[0].subjectName).toBe('Tín dụng');
    expect(result.quiz.questions[0]).not.toHaveProperty('subjectId');
  });

  it('chặn bắt đầu attempt mới khi đã dùng hết số lần thi cho phép', async () => {
    const prisma = {
      quizAttempt: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null), // không có attempt IN_PROGRESS
        count: jest.fn().mockResolvedValue(2), // đã dùng đủ 2/2 lần GRADED
      },
    };
    const assignments = {
      getForUser: jest.fn().mockResolvedValue([
        {
          id: assignmentId,
          quizId: 'quiz-1',
          quiz: { ...snapshot.quiz, maxAttempts: 2 },
        },
      ]),
    };
    const service = new AttemptsService(
      prisma as never,
      assignments as never,
      {} as never,
    );

    await expect(
      service.start('user-1', { id: attemptId, assignmentId }),
    ).rejects.toThrow(/hết số lần làm bài/);
    expect(prisma.quizAttempt.count).toHaveBeenCalledWith({
      where: { userId: 'user-1', assignmentId, status: AttemptStatus.GRADED },
    });
  });

  it('cho phép làm lại khi bộ đề đặt maxAttempts = 0 (không giới hạn)', async () => {
    const prisma = {
      quizAttempt: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(50), // đã làm rất nhiều lần vẫn không sao
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ ...data })),
      },
      quizVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'version-1',
          version: 1,
          snapshot,
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const assignments = {
      getForUser: jest.fn().mockResolvedValue([
        {
          id: assignmentId,
          quizId: 'quiz-1',
          quiz: { ...snapshot.quiz, maxAttempts: 0 },
        },
      ]),
    };
    const service = new AttemptsService(
      prisma as never,
      assignments as never,
      {} as never,
    );

    const result = await service.start('user-1', {
      id: attemptId,
      assignmentId,
    });

    expect(prisma.quizAttempt.count).not.toHaveBeenCalled();
    expect(result.quiz.questions[0].subjectName).toBe('Tín dụng');
  });

  describe('Đổi bộ câu hỏi khi thi lại (retake)', () => {
    it('maxAttempts=1 (mặc định) → không tìm lần thi trước, hành vi y hệt trước khi có tính năng đổi câu', async () => {
      const prisma = {
        quizAttempt: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest.fn().mockResolvedValue(null), // chỉ activeAttempt được hỏi
          count: jest.fn().mockResolvedValue(0),
          create: jest
            .fn()
            .mockImplementation(({ data }) => Promise.resolve({ ...data })),
        },
        quizVersion: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'version-1',
            version: 1,
            snapshot,
            isPersonalized: false,
          }),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      const assignments = {
        getForUser: jest.fn().mockResolvedValue([
          {
            id: assignmentId,
            quizId: 'quiz-1',
            quiz: { ...snapshot.quiz, maxAttempts: 1 },
          },
        ]),
      };
      const service = new AttemptsService(
        prisma as never,
        assignments as never,
        {} as never,
      );

      await service.start('user-1', { id: attemptId, assignmentId });

      // Đúng 1 lần gọi findFirst — chỉ cho activeAttempt, KHÔNG có lần thứ 2 đi
      // tìm lần thi trước (maxAttempts===1 không thể có retake).
      expect(prisma.quizAttempt.findFirst).toHaveBeenCalledTimes(1);
    });

    it('maxAttempts=2, CHƯA có lần GRADED nào trước đó → vẫn dùng bản chung (ensureSnapshot lọc isPersonalized:false), không tạo bộ cá nhân hoá', async () => {
      const prisma = {
        quizAttempt: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(null) // activeAttempt
            .mockResolvedValueOnce(null), // previousAttempt — chưa từng thi
          count: jest.fn().mockResolvedValue(0),
          create: jest
            .fn()
            .mockImplementation(({ data }) => Promise.resolve({ ...data })),
        },
        question: { findMany: jest.fn() },
        quizVersion: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'version-1',
            version: 1,
            snapshot,
            isPersonalized: false,
          }),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      const assignments = {
        getForUser: jest.fn().mockResolvedValue([
          {
            id: assignmentId,
            quizId: 'quiz-1',
            quiz: { ...snapshot.quiz, maxAttempts: 2 },
          },
        ]),
      };
      const service = new AttemptsService(
        prisma as never,
        assignments as never,
        {} as never,
      );

      await service.start('user-1', { id: attemptId, assignmentId });

      expect(prisma.quizVersion.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { quizId: 'quiz-1', isPersonalized: false },
        }),
      );
      expect(prisma.question.findMany).not.toHaveBeenCalled();
    });

    it('maxAttempts=2, đã có 1 lần GRADED trước đó → tạo bộ câu cá nhân hoá, tránh trùng câu cũ khi ngân hàng đủ', async () => {
      const previousSnapshot = {
        quiz: snapshot.quiz,
        questions: [{ ...snapshot.questions[0], id: 'bank-old-1' }],
      };
      const bankPoolCauMoi = [
        {
          id: 'bank-new-1',
          content: 'Câu mới 1',
          imageUrl: null,
          explanation: null,
          questionType: 'SINGLE',
          orderIndex: 0,
          points: 10,
          subjectId: 'subject-1',
          subject: { id: 'subject-1', name: 'Tín dụng' },
          options: [
            {
              id: 'opt-new-1-a',
              content: 'Đúng',
              isCorrect: true,
              orderIndex: 1,
            },
            {
              id: 'opt-new-1-b',
              content: 'Sai',
              isCorrect: false,
              orderIndex: 2,
            },
          ],
        },
      ];
      const prisma = {
        quizAttempt: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(null) // activeAttempt: không có
            .mockResolvedValueOnce({
              quizVersion: { snapshot: previousSnapshot },
            }), // previousAttempt: 1 lần GRADED trước
          count: jest.fn().mockResolvedValue(1), // 1/2 lần GRADED, còn được thi
          create: jest
            .fn()
            .mockImplementation(({ data }) => Promise.resolve({ ...data })),
        },
        question: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([{ subjectId: 'subject-1' }]) // committed — suy tỷ lệ trộn
            .mockResolvedValueOnce(bankPoolCauMoi), // pool ngân hàng cho slot subject-1
        },
        quiz: { findUniqueOrThrow: jest.fn().mockResolvedValue(snapshot.quiz) },
        quizVersion: {
          findFirst: jest.fn().mockResolvedValue({ version: 1 }),
          create: jest
            .fn()
            .mockImplementation(({ data }) =>
              Promise.resolve({ id: 'version-2', ...data }),
            ),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      const assignments = {
        getForUser: jest.fn().mockResolvedValue([
          {
            id: assignmentId,
            quizId: 'quiz-1',
            quiz: { ...snapshot.quiz, maxAttempts: 2 },
          },
        ]),
      };
      const service = new AttemptsService(
        prisma as never,
        assignments as never,
        {} as never,
      );

      const result = await service.start('user-1', {
        id: attemptId,
        assignmentId,
      });

      expect(prisma.quizVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isPersonalized: true }),
        }),
      );
      const chosenIds = result.quiz.questions.map((q) => q.id);
      expect(chosenIds).not.toContain('bank-old-1');
      expect(chosenIds).toContain('bank-new-1');
    });

    it('ngân hàng không còn câu MỚI nào cho 1 lĩnh vực → bù bằng đúng câu cũ của lĩnh vực đó, không throw', async () => {
      const previousSnapshot = {
        quiz: snapshot.quiz,
        questions: [{ ...snapshot.questions[0], id: 'bank-old-1' }],
      };
      const prisma = {
        quizAttempt: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
              quizVersion: { snapshot: previousSnapshot },
            }),
          count: jest.fn().mockResolvedValue(1),
          create: jest
            .fn()
            .mockImplementation(({ data }) => Promise.resolve({ ...data })),
        },
        question: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([{ subjectId: 'subject-1' }]) // committed
            .mockResolvedValueOnce([]), // pool ngân hàng — KHÔNG còn câu mới nào
        },
        quiz: { findUniqueOrThrow: jest.fn().mockResolvedValue(snapshot.quiz) },
        quizVersion: {
          findFirst: jest.fn().mockResolvedValue({ version: 1 }),
          create: jest
            .fn()
            .mockImplementation(({ data }) =>
              Promise.resolve({ id: 'version-2', ...data }),
            ),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      const assignments = {
        getForUser: jest.fn().mockResolvedValue([
          {
            id: assignmentId,
            quizId: 'quiz-1',
            quiz: { ...snapshot.quiz, maxAttempts: 2 },
          },
        ]),
      };
      const service = new AttemptsService(
        prisma as never,
        assignments as never,
        {} as never,
      );

      const result = await service.start('user-1', {
        id: attemptId,
        assignmentId,
      });

      expect(result.quiz.questions).toHaveLength(1);
      expect(result.quiz.questions[0].id).toBe('bank-old-1');
    });

    it('ngân hàng cạn cả câu mới lẫn câu cũ → vẫn cho thi với số câu ít hơn yêu cầu, có log cảnh báo', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const previousSnapshot = { quiz: snapshot.quiz, questions: [] }; // không có câu cũ lĩnh vực này để bù
      const prisma = {
        quizAttempt: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
              quizVersion: { snapshot: previousSnapshot },
            }),
          count: jest.fn().mockResolvedValue(1),
          create: jest
            .fn()
            .mockImplementation(({ data }) => Promise.resolve({ ...data })),
        },
        question: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([
              { subjectId: 'subject-1' },
              { subjectId: 'subject-1' },
            ]) // committed: count=2
            .mockResolvedValueOnce([]), // pool ngân hàng rỗng hoàn toàn
        },
        quiz: { findUniqueOrThrow: jest.fn().mockResolvedValue(snapshot.quiz) },
        quizVersion: {
          findFirst: jest.fn().mockResolvedValue({ version: 1 }),
          create: jest
            .fn()
            .mockImplementation(({ data }) =>
              Promise.resolve({ id: 'version-2', ...data }),
            ),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      const assignments = {
        getForUser: jest.fn().mockResolvedValue([
          {
            id: assignmentId,
            quizId: 'quiz-1',
            quiz: { ...snapshot.quiz, maxAttempts: 2 },
          },
        ]),
      };
      const service = new AttemptsService(
        prisma as never,
        assignments as never,
        {} as never,
      );

      const result = await service.start('user-1', {
        id: attemptId,
        assignmentId,
      });

      expect(result.quiz.questions).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('chỉ đủ 0/2'),
      );
      warnSpy.mockRestore();
    });

    it('đụng P2002 khi tạo QuizVersion (đua race lúc nhiều người thi lại cùng lúc) → tự thử lại, không lỗi cho user', async () => {
      const previousSnapshot = {
        quiz: snapshot.quiz,
        questions: [{ ...snapshot.questions[0], id: 'bank-old-1' }],
      };
      // P2002 giả lập ĐÚNG kiểu lỗi thật của Prisma — bắt buộc dùng instanceof
      // Prisma.PrismaClientKnownRequestError như code thật đang kiểm tra (theo
      // đúng mẫu ở arena.service.spec.ts).
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`quiz_id`,`version`)',
        { code: 'P2002', clientVersion: '6.19.3' },
      );
      const prisma = {
        quizAttempt: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
              quizVersion: { snapshot: previousSnapshot },
            }),
          count: jest.fn().mockResolvedValue(1),
          create: jest
            .fn()
            .mockImplementation(({ data }) => Promise.resolve({ ...data })),
        },
        question: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([{ subjectId: 'subject-1' }])
            .mockResolvedValueOnce([]), // bank rỗng — không quan trọng cho phép thử này
        },
        quiz: { findUniqueOrThrow: jest.fn().mockResolvedValue(snapshot.quiz) },
        quizVersion: {
          findFirst: jest.fn().mockResolvedValue({ version: 1 }),
          create: jest
            .fn()
            .mockRejectedValueOnce(prismaError)
            .mockResolvedValueOnce({
              id: 'version-2',
              quizId: 'quiz-1',
              version: 2,
              isPersonalized: true,
              snapshot: {},
            }),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      const assignments = {
        getForUser: jest.fn().mockResolvedValue([
          {
            id: assignmentId,
            quizId: 'quiz-1',
            quiz: { ...snapshot.quiz, maxAttempts: 2 },
          },
        ]),
      };
      const service = new AttemptsService(
        prisma as never,
        assignments as never,
        {} as never,
      );

      await expect(
        service.start('user-1', { id: attemptId, assignmentId }),
      ).resolves.toBeDefined();
      expect(prisma.quizVersion.create).toHaveBeenCalledTimes(2);
    });

    it('đề không phân lĩnh vực (subjectId null) → 1 slot duy nhất, lọc đúng "không có lĩnh vực" thay vì lấy toàn bộ ngân hàng', async () => {
      const previousSnapshot = {
        quiz: snapshot.quiz,
        questions: [
          { ...snapshot.questions[0], id: 'bank-old-1', subjectId: null },
        ],
      };
      const bankPoolCauMoi = [
        {
          id: 'bank-new-1',
          content: 'Câu mới',
          imageUrl: null,
          explanation: null,
          questionType: 'SINGLE',
          orderIndex: 0,
          points: 10,
          subjectId: null,
          subject: null,
          options: [
            { id: 'opt-a', content: 'Đúng', isCorrect: true, orderIndex: 1 },
            { id: 'opt-b', content: 'Sai', isCorrect: false, orderIndex: 2 },
          ],
        },
      ];
      const prisma = {
        quizAttempt: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
              quizVersion: { snapshot: previousSnapshot },
            }),
          count: jest.fn().mockResolvedValue(1),
          create: jest
            .fn()
            .mockImplementation(({ data }) => Promise.resolve({ ...data })),
        },
        question: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([{ subjectId: null }]) // committed — không phân lĩnh vực
            .mockResolvedValueOnce(bankPoolCauMoi),
        },
        quiz: { findUniqueOrThrow: jest.fn().mockResolvedValue(snapshot.quiz) },
        quizVersion: {
          findFirst: jest.fn().mockResolvedValue({ version: 1 }),
          create: jest
            .fn()
            .mockImplementation(({ data }) =>
              Promise.resolve({ id: 'version-2', ...data }),
            ),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      const assignments = {
        getForUser: jest.fn().mockResolvedValue([
          {
            id: assignmentId,
            quizId: 'quiz-1',
            quiz: { ...snapshot.quiz, maxAttempts: 2 },
          },
        ]),
      };
      const service = new AttemptsService(
        prisma as never,
        assignments as never,
        {} as never,
      );

      const result = await service.start('user-1', {
        id: attemptId,
        assignmentId,
      });

      expect(prisma.question.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { isBank: true, approvalStatus: 'APPROVED', subjectId: null },
        }),
      );
      expect(result.quiz.questions[0].id).toBe('bank-new-1');
    });
  });

  it('bổ sung lĩnh vực cho snapshot cũ thiếu key, không ghi đè QuizVersion', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'question-1',
        subjectId: 'subject-1',
        subject: { name: 'Kế toán' },
      },
    ]);
    const prisma = {
      quizAttempt: {
        findFirst: jest.fn().mockResolvedValue({
          id: attemptId,
          status: AttemptStatus.IN_PROGRESS,
          deadlineAt: new Date('2026-09-03T08:30:00.000Z'),
          answerRevision: 0,
          quizVersion: {
            snapshot: snapshotCuThieuLinhVuc,
            quiz: { instantFeedback: false },
          },
          answers: [],
        }),
      },
      question: { findMany },
      quizVersion: { create: jest.fn(), update: jest.fn() },
    };
    const service = new AttemptsService(
      prisma as never,
      {} as never,
      {} as never,
    );

    const result = await service.get('user-1', attemptId);

    expect(result.quiz.questions[0].subjectName).toBe('Kế toán');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['question-1'] } } }),
    );
    expect(prisma.quizVersion.create).not.toHaveBeenCalled();
    expect(prisma.quizVersion.update).not.toHaveBeenCalled();
  });

  it('không truy vấn lại khi snapshot mới có câu chưa phân loại lĩnh vực', async () => {
    const findMany = jest.fn();
    const snapshotChuaPhanLoai = {
      ...snapshot,
      questions: [
        { ...snapshot.questions[0], subjectId: null, subjectName: null },
      ],
    };
    const prisma = {
      quizAttempt: {
        findFirst: jest.fn().mockResolvedValue({
          id: attemptId,
          status: AttemptStatus.IN_PROGRESS,
          deadlineAt: new Date('2026-09-03T08:30:00.000Z'),
          answerRevision: 0,
          quizVersion: {
            snapshot: snapshotChuaPhanLoai,
            quiz: { instantFeedback: false },
          },
          answers: [],
        }),
      },
      question: { findMany },
    };
    const service = new AttemptsService(
      prisma as never,
      {} as never,
      {} as never,
    );

    const result = await service.get('user-1', attemptId);

    expect(result.quiz.questions[0].subjectName).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  describe('Quiz.shuffleQuestions — xáo trộn thứ tự câu hỏi', () => {
    it('mặc định TẮT: giữ nguyên thứ tự gốc (các câu cùng lĩnh vực vẫn đứng liền khối)', async () => {
      const prisma = {
        quizAttempt: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValue(0),
          create: jest
            .fn()
            .mockImplementation(({ data }) => Promise.resolve({ ...data })),
        },
        quizVersion: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'version-1',
            version: 1,
            snapshot: snapshotNhieuCau,
          }),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      const assignments = {
        getForUser: jest.fn().mockResolvedValue([
          {
            id: assignmentId,
            quizId: 'quiz-1',
            quiz: { ...snapshot.quiz, shuffleQuestions: false },
          },
        ]),
      };
      const service = new AttemptsService(
        prisma as never,
        assignments as never,
        {} as never,
      );

      const result = await service.start('user-1', {
        id: attemptId,
        assignmentId,
      });

      expect(result.quiz.questions.map((q) => q.id)).toEqual(
        snapshotNhieuCau.questions.map((q) => q.id),
      );
    });

    it('BẬT: mỗi attempt ra 1 thứ tự riêng (đúng thuật toán stableShuffle), không còn xếp theo khối lĩnh vực', async () => {
      const prisma = {
        quizAttempt: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValue(0),
          create: jest
            .fn()
            .mockImplementation(({ data }) => Promise.resolve({ ...data })),
        },
        quizVersion: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'version-1',
            version: 1,
            snapshot: snapshotNhieuCau,
          }),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      const assignments = {
        getForUser: jest.fn().mockResolvedValue([
          {
            id: assignmentId,
            quizId: 'quiz-1',
            quiz: { ...snapshot.quiz, shuffleQuestions: true },
          },
        ]),
      };
      const service = new AttemptsService(
        prisma as never,
        assignments as never,
        {} as never,
      );

      // Seed riêng cho test này (khác hằng số attemptId dùng chung cả file) —
      // đã kiểm tra trước: với đúng 5 câu hỏi của snapshotNhieuCau, seed này ra
      // thứ tự THỰC SỰ khác thứ tự gốc, chứng minh được việc xáo trộn có xảy ra.
      const attemptIdRieng = 'attempt-khac-1';
      const result = await service.start('user-1', {
        id: attemptIdRieng,
        assignmentId,
      });

      const expected = stableShuffleGiongHetService(
        snapshotNhieuCau.questions,
        attemptIdRieng,
      ).map((q) => q.id);
      expect(result.quiz.questions.map((q) => q.id)).toEqual(expected);
      // Đúng là có xáo (không trùng thứ tự gốc).
      expect(result.quiz.questions.map((q) => q.id)).not.toEqual(
        snapshotNhieuCau.questions.map((q) => q.id),
      );
      // Không mất/thêm câu nào — chỉ đổi thứ tự.
      expect(new Set(result.quiz.questions.map((q) => q.id))).toEqual(
        new Set(snapshotNhieuCau.questions.map((q) => q.id)),
      );
    });

    it('BẬT: mở lại bài đang làm dở (get) vẫn ra ĐÚNG thứ tự đã thấy lúc bắt đầu (cùng seed = attempt.id)', async () => {
      const prisma = {
        quizAttempt: {
          findFirst: jest.fn().mockResolvedValue({
            id: attemptId,
            status: AttemptStatus.IN_PROGRESS,
            deadlineAt: new Date('2026-09-03T08:30:00.000Z'),
            answerRevision: 0,
            quizVersion: {
              snapshot: snapshotNhieuCau,
              quiz: { instantFeedback: false, shuffleQuestions: true },
            },
            answers: [],
          }),
        },
      };
      const service = new AttemptsService(
        prisma as never,
        {} as never,
        {} as never,
      );

      const result = await service.get('user-1', attemptId);

      const expected = stableShuffleGiongHetService(
        snapshotNhieuCau.questions,
        attemptId,
      ).map((q) => q.id);
      expect(result.quiz.questions.map((q) => q.id)).toEqual(expected);
    });
  });

  it('chốt đáp án trả kết quả + đáp án đúng, và chốt lại không đổi được lựa chọn', async () => {
    const daChot = {
      questionId: 'question-1',
      selectedOptionIds: ['option-2'],
      lockedAt: new Date('2026-09-03T08:02:00.000Z'),
      isCorrect: false,
    };
    const prisma = {
      quizAttempt: {
        findFirst: jest.fn().mockResolvedValue({
          id: attemptId,
          status: AttemptStatus.IN_PROGRESS,
          deadlineAt: new Date('2026-09-03T08:30:00.000Z'),
          answerRevision: 3,
          quizVersion: { snapshot, quiz: { instantFeedback: true } },
          answers: [daChot],
        }),
      },
    };
    const service = new AttemptsService(
      prisma as never,
      {} as never,
      {} as never,
    );

    // Gửi lại chính đáp án ĐÚNG cho câu đã chốt sai — kết quả phải giữ nguyên
    const result = await service.lockAnswer('user-1', attemptId, 'question-1', {
      selectedOptionIds: ['option-1'],
    });

    expect(result.alreadyLocked).toBe(true);
    expect(result.isCorrect).toBe(false);
    expect(result.selectedOptionIds).toEqual(['option-2']);
    expect(result.correctOptionIds).toEqual(['option-1']);
  });

  it('không cho chốt đáp án khi bộ đề tắt phản hồi tức thì', async () => {
    const prisma = {
      quizAttempt: {
        findFirst: jest.fn().mockResolvedValue({
          id: attemptId,
          status: AttemptStatus.IN_PROGRESS,
          deadlineAt: new Date('2026-09-03T08:30:00.000Z'),
          answerRevision: 0,
          quizVersion: { snapshot, quiz: { instantFeedback: false } },
          answers: [],
        }),
      },
    };
    const service = new AttemptsService(
      prisma as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.lockAnswer('user-1', attemptId, 'question-1', {
        selectedOptionIds: ['option-1'],
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('autosave bỏ qua câu đã chốt, không cho sửa lại thành đáp án đúng', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = {
      quizAttempt: {
        findFirst: jest.fn().mockResolvedValue({
          id: attemptId,
          status: AttemptStatus.IN_PROGRESS,
          startedAt: new Date('2026-09-03T08:00:00.000Z'),
          lastSavedAt: new Date('2026-09-03T08:02:00.000Z'),
          deadlineAt: new Date('2026-09-03T08:30:00.000Z'),
          answerRevision: 1,
          quizVersion: { snapshot, quiz: { instantFeedback: true } },
          answers: [
            {
              questionId: 'question-1',
              selectedOptionIds: ['option-2'],
              lockedAt: new Date('2026-09-03T08:02:00.000Z'),
              isCorrect: false,
            },
          ],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      quizAttemptAnswer: { upsert },
      $transaction: jest
        .fn()
        .mockImplementation((fn: (tx: unknown) => unknown) =>
          fn({
            quizAttempt: {
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
              findUniqueOrThrow: jest.fn().mockResolvedValue({
                answerRevision: 2,
                lastSavedAt: new Date('2026-09-03T08:03:00.000Z'),
              }),
            },
            quizAttemptAnswer: { upsert },
          }),
        ),
    };
    const service = new AttemptsService(
      prisma as never,
      {} as never,
      {} as never,
    );

    await service.saveAnswers('user-1', attemptId, {
      revision: 1,
      answers: [{ questionId: 'question-1', selectedOptionIds: ['option-1'] }],
    });

    expect(upsert).not.toHaveBeenCalled();
  });

  it('từ chối autosave từ tab có revision cũ', async () => {
    const prisma = {
      quizAttempt: {
        findFirst: jest.fn().mockResolvedValue({
          id: attemptId,
          status: AttemptStatus.IN_PROGRESS,
          deadlineAt: new Date('2026-09-03T08:30:00.000Z'),
          answerRevision: 2,
          quizVersion: { snapshot },
          answers: [],
        }),
      },
    };
    const service = new AttemptsService(
      prisma as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.saveAnswers('user-1', attemptId, {
        revision: 1,
        answers: [
          { questionId: 'question-1', selectedOptionIds: ['option-1'] },
        ],
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('chấm answers đã lưu trên server từ snapshot và tạo một Submission chính thức', async () => {
    const storedAttempt = {
      id: attemptId,
      assignmentId,
      quizId: 'quiz-1',
      quizVersionId: 'version-1',
      status: AttemptStatus.IN_PROGRESS,
      startedAt: new Date('2026-09-03T08:00:00.000Z'),
      deadlineAt: new Date('2026-09-03T08:30:00.000Z'),
      timedOut: false,
      quizVersion: { snapshot },
      answers: [
        {
          questionId: 'question-1',
          selectedOptionIds: ['option-1'],
          updatedAt: new Date('2026-09-03T08:05:00.000Z'),
        },
      ],
    };
    const prisma = {
      quizAttempt: {
        findFirst: jest.fn().mockResolvedValue(storedAttempt),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0), // chưa có lần GRADED nào trước đó
      },
      submission: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: attemptId,
          status: 'GRADED',
          score: 100,
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const gamification = {
      updateActivity: jest.fn().mockResolvedValue(undefined),
      incrementSubmissionStats: jest.fn().mockResolvedValue(undefined),
      awardXp: jest
        .fn()
        .mockResolvedValue({ levelUp: false, newLevel: 1, newBadges: [] }),
    };
    const service = new AttemptsService(
      prisma as never,
      {} as never,
      gamification as never,
    );

    const result = await service.finalize('user-1', attemptId, false);

    expect(prisma.submission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: attemptId,
        userId: 'user-1',
        quizId: 'quiz-1',
        quizVersionId: 'version-1',
        score: 100,
        isPassed: true,
        startedAt: new Date('2026-09-03T08:00:00.000Z'),
      }),
    });
    expect(gamification.incrementSubmissionStats).toHaveBeenCalledWith(
      'user-1',
      true,
    );
    expect(gamification.awardXp).toHaveBeenCalled();
    expect(result).toMatchObject({ id: attemptId, score: 100, isPassed: true });
  });

  it('không cộng XP khi đây là lần nộp bài thứ 2 trở đi của cùng lượt giao bài', async () => {
    const storedAttempt = {
      id: attemptId,
      assignmentId,
      quizId: 'quiz-1',
      quizVersionId: 'version-1',
      status: AttemptStatus.IN_PROGRESS,
      startedAt: new Date('2026-09-03T08:00:00.000Z'),
      deadlineAt: new Date('2026-09-03T08:30:00.000Z'),
      timedOut: false,
      quizVersion: { snapshot },
      answers: [
        {
          questionId: 'question-1',
          selectedOptionIds: ['option-1'],
          updatedAt: new Date('2026-09-03T08:05:00.000Z'),
        },
      ],
    };
    const prisma = {
      quizAttempt: {
        findFirst: jest.fn().mockResolvedValue(storedAttempt),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(1), // đã có 1 lần GRADED trước đó (làm lại)
      },
      submission: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: attemptId,
          status: 'GRADED',
          score: 100,
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const gamification = {
      updateActivity: jest.fn().mockResolvedValue(undefined),
      incrementSubmissionStats: jest.fn().mockResolvedValue(undefined),
      awardXp: jest.fn().mockResolvedValue({
        levelUp: false,
        newLevel: 1,
        newBadges: [],
      }),
    };
    const service = new AttemptsService(
      prisma as never,
      {} as never,
      gamification as never,
    );

    const result = await service.finalize('user-1', attemptId, false);

    expect(prisma.quizAttempt.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        assignmentId,
        status: AttemptStatus.GRADED,
        id: { not: attemptId },
      },
    });
    expect(gamification.awardXp).not.toHaveBeenCalled();
    expect(gamification.incrementSubmissionStats).not.toHaveBeenCalled();
    expect(gamification.updateActivity).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: attemptId, score: 100, isPassed: true });
  });

  it('violationLimit = 0 (tắt): chỉ tăng bộ đếm vi phạm, không tự nộp bài', async () => {
    const storedAttempt = {
      id: attemptId,
      status: AttemptStatus.IN_PROGRESS,
      quizVersion: { quiz: { violationLimit: 0 } },
    };
    const prisma = {
      quizAttempt: {
        findFirst: jest.fn().mockResolvedValue(storedAttempt),
        update: jest.fn().mockResolvedValue({ violationCount: 1 }),
        updateMany: jest.fn(),
      },
      attemptViolation: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const service = new AttemptsService(
      prisma as never,
      {} as never,
      {} as never,
    );

    const result = await service.reportViolation(
      'user-1',
      attemptId,
      'TAB_HIDDEN',
    );

    expect(result).toEqual({
      violationCount: 1,
      violationLimit: 0,
      autoSubmitted: false,
    });
    expect(prisma.quizAttempt.updateMany).not.toHaveBeenCalled();
  });

  it('bỏ qua, không tăng bộ đếm khi bài đã GRADED', async () => {
    const storedAttempt = {
      id: attemptId,
      status: AttemptStatus.GRADED,
      violationCount: 5,
      quizVersion: { quiz: { violationLimit: 3 } },
    };
    const prisma = {
      quizAttempt: { findFirst: jest.fn().mockResolvedValue(storedAttempt) },
      $transaction: jest.fn(),
    };
    const service = new AttemptsService(
      prisma as never,
      {} as never,
      {} as never,
    );

    const result = await service.reportViolation(
      'user-1',
      attemptId,
      'COPY_ATTEMPT',
    );

    expect(result).toEqual({
      violationCount: 5,
      violationLimit: 3,
      autoSubmitted: false,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('chạm violationLimit: tự nộp bài theo các câu đã lưu, KHÔNG cộng XP', async () => {
    const storedAttempt = {
      id: attemptId,
      assignmentId,
      quizId: 'quiz-1',
      quizVersionId: 'version-1',
      status: AttemptStatus.IN_PROGRESS,
      startedAt: new Date('2026-09-03T08:00:00.000Z'),
      deadlineAt: new Date('2026-09-03T08:30:00.000Z'),
      timedOut: false,
      // Đọc lại từ DB sau khi updateMany đã đặt cờ này — xem giải thích trong
      // comment cạnh reportViolation()/finalize() về thứ tự xảy ra thật.
      violationSubmitted: true,
      quizVersion: {
        snapshot,
        quiz: { violationLimit: 3, instantFeedback: false },
      },
      answers: [
        {
          questionId: 'question-1',
          selectedOptionIds: ['option-1'],
          updatedAt: new Date('2026-09-03T08:05:00.000Z'),
        },
      ],
    };
    const prisma = {
      quizAttempt: {
        findFirst: jest.fn().mockResolvedValue(storedAttempt),
        update: jest.fn().mockResolvedValue({ violationCount: 3 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
      },
      attemptViolation: {
        create: jest.fn().mockResolvedValue({}),
        // Dùng để dựng danh sách lý do hiện trong popup "Bạn đã vi phạm quá số
        // lần được phép" ở màn làm bài
        findMany: jest
          .fn()
          .mockResolvedValue([
            { type: 'TAB_HIDDEN' },
            { type: 'WINDOW_BLUR' },
            { type: 'TAB_HIDDEN' },
          ]),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      submission: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockResolvedValue({ id: attemptId, status: 'GRADED', score: 100 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const gamification = {
      updateActivity: jest.fn(),
      incrementSubmissionStats: jest.fn(),
      awardXp: jest.fn(),
    };
    const service = new AttemptsService(
      prisma as never,
      {} as never,
      gamification as never,
    );

    const result = await service.reportViolation(
      'user-1',
      attemptId,
      'WINDOW_BLUR',
    );

    expect(prisma.quizAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        id: attemptId,
        status: AttemptStatus.IN_PROGRESS,
        violationSubmitted: false,
      },
      data: { violationSubmitted: true },
    });
    expect(result).toEqual({
      violationCount: 3,
      violationLimit: 3,
      autoSubmitted: true,
      submissionId: attemptId,
      violationBreakdown: [
        { type: 'TAB_HIDDEN', count: 2 },
        { type: 'WINDOW_BLUR', count: 1 },
      ],
    });
    expect(gamification.awardXp).not.toHaveBeenCalled();
    expect(gamification.incrementSubmissionStats).not.toHaveBeenCalled();
    expect(gamification.updateActivity).not.toHaveBeenCalled();
  });

  it('chạm violationLimit nhưng thua trong lần "giành quyền" tự nộp: không chấm bài lần 2', async () => {
    const storedAttempt = {
      id: attemptId,
      status: AttemptStatus.IN_PROGRESS,
      quizVersion: { quiz: { violationLimit: 1 } },
    };
    const prisma = {
      quizAttempt: {
        findFirst: jest.fn().mockResolvedValue(storedAttempt),
        update: jest.fn().mockResolvedValue({ violationCount: 1 }),
        // count: 0 = 1 request khác đã thắng và đổi cờ trước, request này không
        // còn dòng nào khớp điều kiện violationSubmitted: false để cập nhật.
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      attemptViolation: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const service = new AttemptsService(
      prisma as never,
      {} as never,
      {} as never,
    );

    const result = await service.reportViolation(
      'user-1',
      attemptId,
      'TAB_HIDDEN',
    );

    expect(result).toEqual({
      violationCount: 1,
      violationLimit: 1,
      autoSubmitted: false,
    });
  });

  it('vi phạm mềm (DEVTOOLS_OPEN) chỉ ghi log, không cộng violationCount/không tự nộp', async () => {
    const storedAttempt = {
      id: attemptId,
      status: AttemptStatus.IN_PROGRESS,
      violationCount: 2,
      quizVersion: { quiz: { violationLimit: 3 } },
    };
    const prisma = {
      quizAttempt: {
        findFirst: jest.fn().mockResolvedValue(storedAttempt),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      attemptViolation: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(),
    };
    const service = new AttemptsService(
      prisma as never,
      {} as never,
      {} as never,
    );

    const result = await service.reportViolation(
      'user-1',
      attemptId,
      'DEVTOOLS_OPEN',
    );

    expect(prisma.attemptViolation.create).toHaveBeenCalledWith({
      data: { attemptId, type: 'DEVTOOLS_OPEN' },
    });
    expect(prisma.quizAttempt.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result).toEqual({
      violationCount: 2, // giữ nguyên, KHÔNG cộng thêm
      violationLimit: 3,
      autoSubmitted: false,
    });
  });

  it('vi phạm mềm (SCREENSHOT_ATTEMPT) cũng không cộng dồn', async () => {
    const storedAttempt = {
      id: attemptId,
      status: AttemptStatus.IN_PROGRESS,
      violationCount: 0,
      quizVersion: { quiz: { violationLimit: 0 } },
    };
    const prisma = {
      quizAttempt: { findFirst: jest.fn().mockResolvedValue(storedAttempt) },
      attemptViolation: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new AttemptsService(
      prisma as never,
      {} as never,
      {} as never,
    );

    const result = await service.reportViolation(
      'user-1',
      attemptId,
      'SCREENSHOT_ATTEMPT',
    );

    expect(result.violationCount).toBe(0);
    expect(result.autoSubmitted).toBe(false);
  });

  describe('finalizeViolationExceededAttempts', () => {
    it('tự nộp đúng các attempt đã chạm ngưỡng, bỏ qua các attempt chưa chạm', async () => {
      const prisma = {
        quizAttempt: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'att-du-nguong',
              userId: 'user-1',
              violationCount: 3,
              quizVersion: { quiz: { violationLimit: 3 } },
            },
            {
              id: 'att-chua-du',
              userId: 'user-2',
              violationCount: 1,
              quizVersion: { quiz: { violationLimit: 3 } },
            },
          ]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findFirst: jest.fn().mockResolvedValue({
            id: 'att-du-nguong',
            status: AttemptStatus.GRADED,
            submissionId: 'sub-1',
          }),
        },
      };
      const service = new AttemptsService(
        prisma as never,
        {} as never,
        {} as never,
      );
      const finalizeSpy = jest
        .spyOn(service, 'finalize')
        .mockResolvedValue({ id: 'sub-1' } as never);

      await service.finalizeViolationExceededAttempts();

      expect(prisma.quizAttempt.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.quizAttempt.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'att-du-nguong',
          status: AttemptStatus.IN_PROGRESS,
          violationSubmitted: false,
        },
        data: { violationSubmitted: true },
      });
      expect(finalizeSpy).toHaveBeenCalledWith(
        'user-1',
        'att-du-nguong',
        false,
      );
    });

    it('không chấm bài nếu "giành quyền" thất bại (nơi khác đã xử lý trước)', async () => {
      const prisma = {
        quizAttempt: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'att-1',
              userId: 'user-1',
              violationCount: 5,
              quizVersion: { quiz: { violationLimit: 3 } },
            },
          ]),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };
      const service = new AttemptsService(
        prisma as never,
        {} as never,
        {} as never,
      );
      const finalizeSpy = jest.spyOn(service, 'finalize');

      await service.finalizeViolationExceededAttempts();

      expect(finalizeSpy).not.toHaveBeenCalled();
    });
  });
});
