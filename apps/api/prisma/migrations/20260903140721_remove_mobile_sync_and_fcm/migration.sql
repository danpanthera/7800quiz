/*
  Warnings:

  - You are about to drop the column `fcm_token` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `sync_outbox` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "fcm_token";

-- DropTable
DROP TABLE "sync_outbox";

-- DropEnum
DROP TYPE "sync_status";
