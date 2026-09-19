-- CreateEnum
CREATE TYPE "AutomationExecutionMode" AS ENUM ('MANUAL', 'EVENT_DRIVEN');

-- AlterTable
ALTER TABLE "Automation" ADD COLUMN "executionMode" "AutomationExecutionMode" NOT NULL DEFAULT 'MANUAL';
