-- AlterTable
ALTER TABLE "temporary_sessions" ADD COLUMN     "chatDisclaimerAcknowledgedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "chatDisclaimerAcknowledgedAt" TIMESTAMP(3);
