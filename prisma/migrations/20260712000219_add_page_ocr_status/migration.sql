/*
  Warnings:

  - You are about to drop the column `accepted` on the `pages` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('PENDING', 'OCR_COMPLETE', 'OCR_FAILED', 'ACCEPTED');

-- AlterTable
ALTER TABLE "pages" DROP COLUMN "accepted",
ADD COLUMN     "ocrFailureReason" TEXT,
ADD COLUMN     "status" "PageStatus" NOT NULL DEFAULT 'PENDING';
