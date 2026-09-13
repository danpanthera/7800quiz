-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "attempt_violation_type" ADD VALUE 'IDLE_TIMEOUT';
ALTER TYPE "attempt_violation_type" ADD VALUE 'MULTI_SESSION_LOGIN';
ALTER TYPE "attempt_violation_type" ADD VALUE 'DEVTOOLS_OPEN';
ALTER TYPE "attempt_violation_type" ADD VALUE 'SCREENSHOT_ATTEMPT';
