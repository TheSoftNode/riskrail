-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PositionType" AS ENUM ('WALLET', 'STREAM', 'LENDING', 'BORROWING', 'LIQUIDITY', 'STAKING', 'VAULT');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "notifyByEmail" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastIndexedAt" TIMESTAMP(3),

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Protocol" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "protocolType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "adapterVersion" INTEGER NOT NULL DEFAULT 1,
    "contractIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Protocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "type" "PositionType" NOT NULL,
    "valueUsd" DECIMAL(38,12),
    "blockHeight" BIGINT NOT NULL,
    "exact" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "closedAt" TIMESTAMP(3),
    "raw" JSONB NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionAsset" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "amountAtomic" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "valueUsd" DECIMAL(38,12),

    CONSTRAINT "PositionAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionSnapshot" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "valueUsd" DECIMAL(38,12),
    "state" JSONB NOT NULL,
    "blockHeight" BIGINT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PositionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "totalValueUsd" DECIMAL(38,12) NOT NULL,
    "protocolValues" JSONB NOT NULL,
    "assetValues" JSONB NOT NULL,
    "valuationCoverageBps" INTEGER NOT NULL,
    "blockHeight" BIGINT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskSnapshot" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "riskScoreBps" INTEGER NOT NULL,
    "healthFactorE4" INTEGER,
    "liquidationDistanceBps" INTEGER,
    "protocolConcentrationBps" INTEGER NOT NULL,
    "assetConcentrationBps" INTEGER NOT NULL,
    "liquidityScoreBps" INTEGER NOT NULL,
    "capitalAccessibilityBps" INTEGER NOT NULL,
    "reportHash" TEXT NOT NULL,
    "report" JSONB NOT NULL,
    "methodologyVersion" TEXT NOT NULL DEFAULT 'rivisk-v1',
    "sourceBlock" BIGINT NOT NULL,
    "onchainSnapshotId" BIGINT,
    "onchainTxId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceObservation" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "priceUsd" DECIMAL(38,12) NOT NULL,
    "source" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexingRun" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "sourceBlock" BIGINT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "IndexingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "threshold" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyBreachEvent" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'onchain-policy',
    "metric" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "threshold" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sourceBlock" BIGINT NOT NULL,
    "metadata" JSONB NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyBreachEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secretCipher" TEXT NOT NULL,
    "events" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "statusCode" INTEGER,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexedBlock" (
    "height" BIGINT NOT NULL,
    "blockHash" TEXT NOT NULL,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndexedBlock_pkey" PRIMARY KEY ("height")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Position_walletId_active_observedAt_idx" ON "Position"("walletId", "active", "observedAt");

-- CreateIndex
CREATE INDEX "Position_protocolId_idx" ON "Position"("protocolId");

-- CreateIndex
CREATE INDEX "PositionAsset_positionId_idx" ON "PositionAsset"("positionId");

-- CreateIndex
CREATE INDEX "PositionAsset_assetId_idx" ON "PositionAsset"("assetId");

-- CreateIndex
CREATE INDEX "PositionSnapshot_positionId_observedAt_idx" ON "PositionSnapshot"("positionId", "observedAt");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_walletId_observedAt_idx" ON "PortfolioSnapshot"("walletId", "observedAt");

-- CreateIndex
CREATE INDEX "RiskSnapshot_walletId_observedAt_idx" ON "RiskSnapshot"("walletId", "observedAt");

-- CreateIndex
CREATE INDEX "RiskSnapshot_reportHash_idx" ON "RiskSnapshot"("reportHash");

-- CreateIndex
CREATE INDEX "PriceObservation_assetId_observedAt_idx" ON "PriceObservation"("assetId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IndexingRun_correlationId_key" ON "IndexingRun"("correlationId");

-- CreateIndex
CREATE INDEX "IndexingRun_walletId_startedAt_idx" ON "IndexingRun"("walletId", "startedAt");

-- CreateIndex
CREATE INDEX "AlertRule_walletId_status_idx" ON "AlertRule"("walletId", "status");

-- CreateIndex
CREATE INDEX "AlertEvent_alertId_triggeredAt_idx" ON "AlertEvent"("alertId", "triggeredAt");

-- CreateIndex
CREATE INDEX "PolicyBreachEvent_walletId_triggeredAt_idx" ON "PolicyBreachEvent"("walletId", "triggeredAt");

-- CreateIndex
CREATE INDEX "PolicyBreachEvent_walletId_metric_triggeredAt_idx" ON "PolicyBreachEvent"("walletId", "metric", "triggeredAt");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_userId_idx" ON "WebhookEndpoint"("userId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_createdAt_idx" ON "WebhookDelivery"("endpointId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IndexedBlock_blockHash_key" ON "IndexedBlock"("blockHash");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionAsset" ADD CONSTRAINT "PositionAsset_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionSnapshot" ADD CONSTRAINT "PositionSnapshot_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSnapshot" ADD CONSTRAINT "RiskSnapshot_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndexingRun" ADD CONSTRAINT "IndexingRun_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyBreachEvent" ADD CONSTRAINT "PolicyBreachEvent_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

