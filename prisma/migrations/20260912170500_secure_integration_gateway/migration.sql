-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('GOOGLE', 'SLACK', 'MICROSOFT', 'NOTION');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'EXPIRED', 'ERROR');

-- CreateEnum
CREATE TYPE "GrantStatus" AS ENUM ('ISSUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GatewayOperationStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "Automation" ADD COLUMN "integrationRequirements" JSONB;

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accountEmail" TEXT,
    "accountName" TEXT,
    "accountAvatarUrl" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "accessTokenIv" TEXT NOT NULL,
    "accessTokenAuthTag" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "refreshTokenIv" TEXT NOT NULL,
    "refreshTokenAuthTag" TEXT NOT NULL,
    "vaultVersion" INTEGER NOT NULL DEFAULT 1,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[],
    "status" "ConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "lastRefreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorMessage" TEXT,
    "refreshLockUntil" TIMESTAMP(3),
    "refreshLockToken" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAutomationIntegration" (
    "id" TEXT NOT NULL,
    "userAutomationId" TEXT NOT NULL,
    "integrationConnectionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAutomationIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecutionGrant" (
    "id" TEXT NOT NULL,
    "grantTokenHash" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "userAutomationId" TEXT NOT NULL,
    "automationExecutionId" TEXT NOT NULL,
    "integrationConnectionId" TEXT NOT NULL,
    "allowedCapability" TEXT NOT NULL,
    "status" "GrantStatus" NOT NULL DEFAULT 'ISSUED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "consumedByIp" TEXT,
    "processingStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExecutionGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAuthorizationSession" (
    "id" TEXT NOT NULL,
    "stateNonceHash" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "codeVerifierEnc" TEXT NOT NULL,
    "codeVerifierIv" TEXT NOT NULL,
    "codeVerifierTag" TEXT NOT NULL,
    "userAutomationId" TEXT,
    "returnUrl" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAuthorizationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationGatewayOperation" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "automationExecutionId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "GatewayOperationStatus" NOT NULL DEFAULT 'PENDING',
    "gmailMessageId" TEXT,
    "gmailThreadId" TEXT,
    "sanitizedResponse" JSONB,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationGatewayOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationConnection_clerkUserId_provider_status_idx" ON "IntegrationConnection"("clerkUserId", "provider", "status");

-- CreateIndex
CREATE INDEX "IntegrationConnection_tokenExpiresAt_idx" ON "IntegrationConnection"("tokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_clerkUserId_provider_providerAccountI_key" ON "IntegrationConnection"("clerkUserId", "provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "UserAutomationIntegration_integrationConnectionId_idx" ON "UserAutomationIntegration"("integrationConnectionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAutomationIntegration_userAutomationId_role_key" ON "UserAutomationIntegration"("userAutomationId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationExecutionGrant_grantTokenHash_key" ON "AutomationExecutionGrant"("grantTokenHash");

-- CreateIndex
CREATE INDEX "AutomationExecutionGrant_expiresAt_idx" ON "AutomationExecutionGrant"("expiresAt");

-- CreateIndex
CREATE INDEX "AutomationExecutionGrant_clerkUserId_idx" ON "AutomationExecutionGrant"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorizationSession_stateNonceHash_key" ON "OAuthAuthorizationSession"("stateNonceHash");

-- CreateIndex
CREATE INDEX "OAuthAuthorizationSession_expiresAt_idx" ON "OAuthAuthorizationSession"("expiresAt");

-- CreateIndex
CREATE INDEX "OAuthAuthorizationSession_clerkUserId_idx" ON "OAuthAuthorizationSession"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationGatewayOperation_idempotencyKey_key" ON "AutomationGatewayOperation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AutomationGatewayOperation_automationExecutionId_idx" ON "AutomationGatewayOperation"("automationExecutionId");

-- CreateIndex
CREATE INDEX "AutomationGatewayOperation_clerkUserId_idx" ON "AutomationGatewayOperation"("clerkUserId");

-- AddForeignKey
ALTER TABLE "UserAutomationIntegration" ADD CONSTRAINT "UserAutomationIntegration_userAutomationId_fkey" FOREIGN KEY ("userAutomationId") REFERENCES "UserAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAutomationIntegration" ADD CONSTRAINT "UserAutomationIntegration_integrationConnectionId_fkey" FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecutionGrant" ADD CONSTRAINT "AutomationExecutionGrant_userAutomationId_fkey" FOREIGN KEY ("userAutomationId") REFERENCES "UserAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecutionGrant" ADD CONSTRAINT "AutomationExecutionGrant_automationExecutionId_fkey" FOREIGN KEY ("automationExecutionId") REFERENCES "AutomationExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecutionGrant" ADD CONSTRAINT "AutomationExecutionGrant_integrationConnectionId_fkey" FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationGatewayOperation" ADD CONSTRAINT "AutomationGatewayOperation_automationExecutionId_fkey" FOREIGN KEY ("automationExecutionId") REFERENCES "AutomationExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
