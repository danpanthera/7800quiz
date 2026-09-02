import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuizService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.quiz.findUniqueOrThrow({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });
  }

  // Trả về câu hỏi + đáp án lựa chọn (không có isCorrect để tránh lộ đáp án)
  async getQuizContent(id: string) {
    let quiz = await this.prisma.quiz.findUniqueOrThrow({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { id: true, version: true },
        },
      },
    });

    // Auto-create version v1 nếu quiz chưa có version nào
    if (quiz.versions.length === 0) {
      const newVersion = await this.prisma.quizVersion.create({
        data: { quizId: id, version: 1, snapshot: {} },
        select: { id: true, version: true },
      });
      quiz = { ...quiz, versions: [newVersion] };
    }

    const questions = await this.prisma.question.findMany({
      where: { quizId: id },
      orderBy: { orderIndex: 'asc' },
      include: {
        options: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            content: true,
            orderIndex: true,
            isCorrect: true,
          },
        },
      },
    });

    return { quiz, questions };
  }
}
