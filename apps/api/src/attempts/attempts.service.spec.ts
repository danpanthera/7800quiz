import { AttemptsService } from './attempts.service';
import { AttemptStatus } from '@prisma/client';

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
      options: [
        { id: 'option-1', content: 'Đúng', isCorrect: true, orderIndex: 1 },
        { id: 'option-2', content: 'Sai', isCorrect: false, orderIndex: 2 },
      ],
    },
  ],
};

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
    expect(result).toMatchObject({ id: attemptId, score: 100, isPassed: true });
  });
});
