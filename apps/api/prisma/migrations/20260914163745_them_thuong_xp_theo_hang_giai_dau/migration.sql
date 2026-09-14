-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "xp_source" ADD VALUE 'TOURNAMENT_CHAMPION';
ALTER TYPE "xp_source" ADD VALUE 'TOURNAMENT_RUNNER_UP';
ALTER TYPE "xp_source" ADD VALUE 'TOURNAMENT_THIRD_PLACE';
ALTER TYPE "xp_source" ADD VALUE 'TOURNAMENT_CONSOLATION';

-- AlterTable
ALTER TABLE "tournament_teams" ADD COLUMN     "eliminated_at_round" INTEGER;
