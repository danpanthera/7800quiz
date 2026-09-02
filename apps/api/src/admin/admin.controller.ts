import {
  BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query,
  UploadedFile, UseGuards, UseInterceptors, Res, StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from './admin.service';

@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ── Subjects ──────────────────────────────────────────────────────────
  @Get('subjects')
  getSubjects() { return this.adminService.getSubjects(); }

  @Post('subjects')
  createSubject(@Body() body: { name: string; description?: string }) {
    return this.adminService.createSubject(body);
  }

  @Put('subjects/:id')
  updateSubject(@Param('id') id: string, @Body() body: { name?: string; description?: string }) {
    return this.adminService.updateSubject(id, body);
  }

  @Delete('subjects/:id')
  deleteSubject(@Param('id') id: string) { return this.adminService.deleteSubject(id); }

  // ── Bank Questions ────────────────────────────────────────────────────
  @Get('bank-questions')
  getBankQuestions(@Query('subjectId') subjectId?: string) {
    return this.adminService.getBankQuestions(subjectId);
  }

  @Post('bank-questions')
  createBankQuestion(@Body() body: any) { return this.adminService.createBankQuestion(body); }

  @Put('bank-questions/:id')
  updateBankQuestion(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateBankQuestion(id, body);
  }

  @Delete('bank-questions/:id')
  deleteBankQuestion(@Param('id') id: string) { return this.adminService.deleteBankQuestion(id); }

  // ── Import Excel ─────────────────────────────────────────────────────
  @Post('bank-questions/import')
  @UseInterceptors(FileInterceptor('file'))
  importQuestions(
    @UploadedFile() file: Express.Multer.File,
    @Body('subjectId') subjectId: string,
    @Body('dryRun') dryRun?: string,
  ) {
    return this.adminService.importQuestionsFromExcel(file.buffer, subjectId, dryRun === 'true');
  }

  // ── Duplicate check ───────────────────────────────────────────────────
  @Post('bank-questions/check-duplicates')
  checkDuplicates(@Body() body: { texts: string[] }) {
    return this.adminService.checkDuplicates(body.texts);
  }

  // ── Spell check ───────────────────────────────────────────────────────
  @Post('bank-questions/check-spelling')
  checkSpelling(@Body() body: { texts: string[] }) {
    return this.adminService.checkSpelling(body.texts);
  }

  // ── Questions ─────────────────────────────────────────────────────────
  @Get('questions')
  getQuestions() { return this.adminService.getQuestions(); }

  @Delete('questions/:id')
  deleteQuestion(@Param('id') id: string) { return this.adminService.deleteQuestion(id); }

  // ── Quizzes ───────────────────────────────────────────────────────────
  @Get('quizzes')
  getQuizzes() { return this.adminService.getQuizzes(); }

  @Get('quizzes/:id')
  getQuiz(@Param('id') id: string) { return this.adminService.getQuiz(id); }

  @Post('quizzes')
  createQuiz(@Body() body: { title: string; description?: string; topic?: string; durationMin: number; passScore?: number }) {
    return this.adminService.createQuiz(body);
  }

  @Put('quizzes/:id')
  updateQuiz(@Param('id') id: string, @Body() body: any) { return this.adminService.updateQuiz(id, body); }

  @Delete('quizzes/:id')
  deleteQuiz(@Param('id') id: string) { return this.adminService.deleteQuiz(id); }

  @Post('quizzes/:id/pick-random')
  pickRandom(@Param('id') id: string, @Body() body: { subjectId?: string; count?: number; subjectSlots?: { subjectId?: string; count: number }[]; replaceAll?: boolean }) {
    return this.adminService.pickRandomToQuiz(id, body);
  }

  // ── Assignments ───────────────────────────────────────────────────────
  @Get('assignments')
  getAssignments() { return this.adminService.getAssignments(); }

  @Post('assignments')
  createAssignment(@Body() body: any) { return this.adminService.createAssignment(body); }
  @Post('assignments/bulk')
  createAssignmentsBulk(@Body() body: any) { return this.adminService.createAssignmentsBulk(body); }
  @Put('assignments/:id')
  updateAssignment(@Param('id') id: string, @Body() body: any) { return this.adminService.updateAssignment(id, body); }

  @Delete('assignments/:id')
  deleteAssignment(@Param('id') id: string) { return this.adminService.deleteAssignment(id); }

  // ── Reports ───────────────────────────────────────────────────────────
  @Get('reports')
  getReports() { return this.adminService.getReports(); }

  @Delete('reports/:id')
  deleteReport(@Param('id') id: string) { return this.adminService.deleteReport(id); }

  // ── Users ─────────────────────────────────────────────────────────────
  @Get('users')
  getUsers() { return this.adminService.getUsers(); }

  // ── Academic Years ────────────────────────────────────────────────────
  @Get('academic-years')
  getAcademicYears() { return this.adminService.getAcademicYears(); }

  @Post('academic-years')
  createAcademicYear(@Body() body: { name: string; startYear: number; endYear: number; isActive?: boolean }) {
    return this.adminService.createAcademicYear(body);
  }

  @Put('academic-years/:id')
  updateAcademicYear(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateAcademicYear(id, body);
  }

  @Delete('academic-years/:id')
  deleteAcademicYear(@Param('id') id: string) { return this.adminService.deleteAcademicYear(id); }

  // ── Classes ───────────────────────────────────────────────────────────
  @Get('classes')
  getClasses(@Query('academicYearId') academicYearId?: string) { return this.adminService.getClasses(academicYearId); }

  @Get('classes/:id')
  getClass(@Param('id') id: string) { return this.adminService.getClass(id); }

  @Post('classes')
  createClass(@Body() body: any) { return this.adminService.createClass(body); }

  @Put('classes/:id')
  updateClass(@Param('id') id: string, @Body() body: any) { return this.adminService.updateClass(id, body); }

  @Delete('classes/:id')
  deleteClass(@Param('id') id: string) { return this.adminService.deleteClass(id); }

  @Post('classes/:id/members')
  addClassMember(@Param('id') classId: string, @Body() body: { userId: string }) {
    return this.adminService.addClassMember(classId, body.userId);
  }

  @Post('classes/:id/members/bulk')
  addClassMembersBulk(@Param('id') classId: string, @Body() body: { userIds: string[] }) {
    return this.adminService.addClassMembersbulk(classId, body.userIds);
  }

  @Delete('classes/:id/members/:userId')
  removeClassMember(@Param('id') classId: string, @Param('userId') userId: string) {
    return this.adminService.removeClassMember(classId, userId);
  }

  // ── Exam Sessions ─────────────────────────────────────────────────────
  @Get('exam-sessions')
  getExamSessions(@Query('classId') classId?: string) { return this.adminService.getExamSessions(classId); }

  @Get('exam-sessions/:id')
  getExamSession(@Param('id') id: string) { return this.adminService.getExamSession(id); }

  @Post('exam-sessions')
  createExamSession(@Body() body: any) { return this.adminService.createExamSession(body); }

  @Put('exam-sessions/:id')
  updateExamSession(@Param('id') id: string, @Body() body: any) { return this.adminService.updateExamSession(id, body); }

  @Delete('exam-sessions/:id')
  deleteExamSession(@Param('id') id: string) { return this.adminService.deleteExamSession(id); }

  @Get('exam-sessions/:id/gradebook')
  getGradebook(@Param('id') id: string) { return this.adminService.getExamSessionGradebook(id); }

  @Get('exam-sessions/:id/leaderboard')
  getLeaderboard(@Param('id') id: string) { return this.adminService.getExamSessionLeaderboard(id); }

  @Get('exam-sessions/:id/attempts/:userId')
  getAttemptHistory(@Param('id') sessionId: string, @Param('userId') userId: string) {
    return this.adminService.getAttemptHistory(sessionId, userId);
  }

  @Get('exam-sessions/:id/export')
  async exportGradebook(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.adminService.exportGradebook(id);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
    return new StreamableFile(buffer);
  }

  @Get('exam-sessions/:id/question-stats')
  getQuestionStats(@Param('id') id: string) { return this.adminService.getQuestionStats(id); }

  @Get('exam-sessions/:id/not-attempted')
  getNotAttempted(@Param('id') id: string) { return this.adminService.getNotAttempted(id); }

  @Get('exam-sessions/:id/certificate/:userId')
  getCertificateData(@Param('id') id: string, @Param('userId') userId: string) {
    return this.adminService.getCertificateData(id, userId);
  }

  // ── Departments ───────────────────────────────────────────────────────
  @Get('departments')
  getDepartments() { return this.adminService.getDepartments(); }

  // ── Cán bộ ────────────────────────────────────────────────────────────
  @Get('can-bo')
  getCanBo(
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
    @Query('unitId') unitId?: string,
  ) { return this.adminService.getCanBo(search, departmentId, unitId); }

  @Post('can-bo/reset-passwords')
  resetCanBoPasswords(@Body() body: { ids: string[] }) {
    return this.adminService.resetCanBoPasswords(body.ids);
  }

  @Delete('can-bo/bulk')
  bulkDeleteCanBo(@Body() body: { ids: string[] }) {
    return this.adminService.bulkDeleteCanBo(body.ids);
  }

  @Post('can-bo/import')
  @UseInterceptors(FileInterceptor('file'))
  importCanBo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa chọn file');
    return this.adminService.importCanBoFromGahr26(file.buffer);
  }

  @Post('can-bo')
  createCanBo(@Body() body: any) { return this.adminService.createCanBo(body); }

  @Put('can-bo/:id')
  updateCanBo(@Param('id') id: string, @Body() body: any) { return this.adminService.updateCanBo(id, body); }

  @Delete('can-bo/:id')
  deleteCanBo(@Param('id') id: string) { return this.adminService.deleteCanBo(id); }
}

