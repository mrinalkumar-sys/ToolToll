-- AlterTable
ALTER TABLE "tool_calls" ADD COLUMN     "endpointId" TEXT;

-- AlterTable
ALTER TABLE "tool_test_runs" ADD COLUMN     "endpointId" TEXT;

-- AlterTable
ALTER TABLE "tools" ADD COLUMN     "exampleRequest" JSONB,
ADD COLUMN     "exampleResponse" JSONB;

-- CreateTable
CREATE TABLE "tool_endpoints" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "endpointPath" TEXT NOT NULL,
    "httpMethod" TEXT NOT NULL DEFAULT 'POST',
    "inputSchema" JSONB NOT NULL,
    "exampleRequest" JSONB,
    "outputSchema" JSONB,
    "exampleResponse" JSONB,
    "authMethod" TEXT NOT NULL DEFAULT 'NONE',
    "authHeaderName" TEXT,
    "encryptedSecret" TEXT,
    "secretKeyVersion" TEXT,
    "priceMicroUsd" BIGINT NOT NULL DEFAULT 1000,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tool_endpoints_toolId_idx" ON "tool_endpoints"("toolId");

-- CreateIndex
CREATE INDEX "tool_endpoints_status_idx" ON "tool_endpoints"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tool_endpoints_toolId_endpointPath_httpMethod_key" ON "tool_endpoints"("toolId", "endpointPath", "httpMethod");

-- AddForeignKey
ALTER TABLE "tool_endpoints" ADD CONSTRAINT "tool_endpoints_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_test_runs" ADD CONSTRAINT "tool_test_runs_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "tool_endpoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "tool_endpoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
