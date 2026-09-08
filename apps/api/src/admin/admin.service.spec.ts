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
