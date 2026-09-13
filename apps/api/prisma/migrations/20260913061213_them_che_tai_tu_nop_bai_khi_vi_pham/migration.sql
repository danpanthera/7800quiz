-- AlterEnum
ALTER TYPE "attempt_violation_type" ADD VALUE 'WINDOW_BLUR';

-- AlterTable
ALTER TABLE "quiz_attempts" ADD COLUMN     "violation_submitted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "violation_limit" INTEGER NOT NULL DEFAULT 0;
