import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuizService } from './quiz.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get('quiz/:id')
  getQuiz(@Param('id') id: string) {
    return this.quizService.getQuizContent(id);
  }
}
