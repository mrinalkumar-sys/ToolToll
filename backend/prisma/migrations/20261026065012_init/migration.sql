-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isCreator" BOOLEAN NOT NULL DEFAULT false,
    "isConsumer" BOOLEAN NOT NULL DEFAULT true,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "reservedBalance" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_reservations" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "agentId" TEXT,
    "toolId" TEXT,
    "callId" TEXT,
    "amount" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "walletId" TEXT,
    "callId" TEXT,
    "account" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "balanceAfter" BIGINT,
    "description" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxPerCallMicroUsd" BIGINT NOT NULL DEFAULT 1000000,
    "dailyBudgetMicroUsd" BIGINT NOT NULL DEFAULT 50000000,
    "monthlyBudgetMicroUsd" BIGINT NOT NULL DEFAULT 500000000,
    "approvalThresholdMicroUsd" BIGINT NOT NULL DEFAULT 5000000,
    "autoApproveTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_credentials" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default Key',
    "scopes" TEXT[] DEFAULT ARRAY['tools:execute', 'tools:read']::TEXT[],
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_permissions" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "toolId" TEXT,
    "category" TEXT,
    "isAllowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tools" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "detailedDescription" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "baseUrl" TEXT NOT NULL,
    "endpointPath" TEXT NOT NULL,
    "httpMethod" TEXT NOT NULL DEFAULT 'POST',
    "inputSchema" JSONB NOT NULL,
    "outputSchema" JSONB,
    "authMethod" TEXT NOT NULL DEFAULT 'NONE',
    "authHeaderName" TEXT,
    "encryptedSecret" TEXT,
    "secretKeyVersion" TEXT,
    "priceMicroUsd" BIGINT NOT NULL DEFAULT 1000,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 60,
    "terms" TEXT,
    "supportContact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_versions" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "inputSchema" JSONB NOT NULL,
    "outputSchema" JSONB,
    "priceMicroUsd" BIGINT NOT NULL,
    "endpointPath" TEXT NOT NULL,
    "httpMethod" TEXT NOT NULL,
    "authMethod" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_test_runs" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "sampleInput" JSONB NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "latencyMs" INTEGER,
    "isSuccess" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_calls" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "priceMicroUsd" BIGINT NOT NULL,
    "platformFeeBps" INTEGER NOT NULL,
    "platformFeeMicroUsd" BIGINT NOT NULL,
    "creatorEarningsMicroUsd" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "sanitizedInput" JSONB NOT NULL,
    "sanitizedOutput" JSONB,
    "httpStatus" INTEGER,
    "latencyMs" INTEGER,
    "failureReason" TEXT,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_earnings" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "toolCallId" TEXT,
    "toolId" TEXT NOT NULL,
    "grossMicroUsd" BIGINT NOT NULL,
    "platformFeeMicroUsd" BIGINT NOT NULL,
    "netMicroUsd" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAYABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topups" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amountMicroUsd" BIGINT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "paypalOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paypal_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountUsd" TEXT NOT NULL,
    "amountMicroUsd" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "rawCapture" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paypal_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'PAYPAL',
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "resourceType" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_requests" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "amountMicroUsd" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payoutMethod" TEXT NOT NULL DEFAULT 'PAYPAL',
    "destination" TEXT NOT NULL,
    "externalBatchId" TEXT,
    "isSimulated" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_reviews" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "callId" TEXT,
    "layer" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "score" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "agentId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_reviews" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abuse_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT,
    "toolId" TEXT NOT NULL,
    "callId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abuse_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_reservations_callId_key" ON "wallet_reservations"("callId");

-- CreateIndex
CREATE INDEX "wallet_reservations_walletId_status_idx" ON "wallet_reservations"("walletId", "status");

-- CreateIndex
CREATE INDEX "ledger_entries_walletId_createdAt_idx" ON "ledger_entries"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "ledger_entries_referenceId_idx" ON "ledger_entries"("referenceId");

-- CreateIndex
CREATE INDEX "ledger_entries_callId_idx" ON "ledger_entries"("callId");

-- CreateIndex
CREATE INDEX "agents_userId_idx" ON "agents"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_credentials_tokenHash_key" ON "agent_credentials"("tokenHash");

-- CreateIndex
CREATE INDEX "agent_credentials_agentId_idx" ON "agent_credentials"("agentId");

-- CreateIndex
CREATE INDEX "agent_credentials_prefix_idx" ON "agent_credentials"("prefix");

-- CreateIndex
CREATE INDEX "agent_permissions_agentId_idx" ON "agent_permissions"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_permissions_agentId_toolId_key" ON "agent_permissions"("agentId", "toolId");

-- CreateIndex
CREATE UNIQUE INDEX "tools_slug_key" ON "tools"("slug");

-- CreateIndex
CREATE INDEX "tools_creatorId_idx" ON "tools"("creatorId");

-- CreateIndex
CREATE INDEX "tools_category_idx" ON "tools"("category");

-- CreateIndex
CREATE INDEX "tools_status_idx" ON "tools"("status");

-- CreateIndex
CREATE INDEX "tool_versions_toolId_idx" ON "tool_versions"("toolId");

-- CreateIndex
CREATE UNIQUE INDEX "tool_versions_toolId_version_key" ON "tool_versions"("toolId", "version");

-- CreateIndex
CREATE INDEX "tool_test_runs_toolId_idx" ON "tool_test_runs"("toolId");

-- CreateIndex
CREATE INDEX "tool_calls_toolId_status_idx" ON "tool_calls"("toolId", "status");

-- CreateIndex
CREATE INDEX "tool_calls_agentId_createdAt_idx" ON "tool_calls"("agentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tool_calls_agentId_idempotencyKey_key" ON "tool_calls"("agentId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "creator_earnings_toolCallId_key" ON "creator_earnings"("toolCallId");

-- CreateIndex
CREATE INDEX "creator_earnings_creatorId_idx" ON "creator_earnings"("creatorId");

-- CreateIndex
CREATE INDEX "creator_earnings_toolId_idx" ON "creator_earnings"("toolId");

-- CreateIndex
CREATE UNIQUE INDEX "topups_paypalOrderId_key" ON "topups"("paypalOrderId");

-- CreateIndex
CREATE INDEX "topups_walletId_idx" ON "topups"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "paypal_orders_orderId_key" ON "paypal_orders"("orderId");

-- CreateIndex
CREATE INDEX "paypal_orders_userId_idx" ON "paypal_orders"("userId");

-- CreateIndex
CREATE INDEX "paypal_orders_orderId_idx" ON "paypal_orders"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_eventId_key" ON "webhook_events"("eventId");

-- CreateIndex
CREATE INDEX "webhook_events_eventId_idx" ON "webhook_events"("eventId");

-- CreateIndex
CREATE INDEX "payout_requests_creatorId_idx" ON "payout_requests"("creatorId");

-- CreateIndex
CREATE INDEX "quality_reviews_toolId_idx" ON "quality_reviews"("toolId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "admin_reviews_toolId_idx" ON "admin_reviews"("toolId");

-- CreateIndex
CREATE INDEX "abuse_reports_toolId_idx" ON "abuse_reports"("toolId");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_reservations" ADD CONSTRAINT "wallet_reservations_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_credentials" ADD CONSTRAINT "agent_credentials_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_permissions" ADD CONSTRAINT "agent_permissions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tools" ADD CONSTRAINT "tools_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_versions" ADD CONSTRAINT "tool_versions_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_test_runs" ADD CONSTRAINT "tool_test_runs_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "tools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_earnings" ADD CONSTRAINT "creator_earnings_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_earnings" ADD CONSTRAINT "creator_earnings_toolCallId_fkey" FOREIGN KEY ("toolCallId") REFERENCES "tool_calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topups" ADD CONSTRAINT "topups_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_reviews" ADD CONSTRAINT "quality_reviews_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_reviews" ADD CONSTRAINT "admin_reviews_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
