import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateJwtToken } from '../src/lib/auth';

describe('Phase 3: APIMatic + Postman Complete Workflow E2E Integration', () => {
  let testServer: http.Server;
  let serverPort: number;

  let creatorToken: string;
  let unauthorizedToken: string;
  let adminToken: string;
  let creatorUser: any;
  let unauthorizedUser: any;
  let adminUser: any;
  let consumerUser: any;

  let validSpecYaml: string;
  let invalidSpecYaml: string;
  let onboardedToolId: string;
  let primaryEndpointId: string;
  const agentKey = 'tt_live_demo1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  before(async () => {
    // 1. Start live HTTP server on ephemeral port for Newman runtime test execution
    await new Promise<void>((resolve) => {
      testServer = app.listen(0, '127.0.0.1', () => {
        serverPort = (testServer.address() as any).port;
        resolve();
      });
    });

    // 2. Load accounts and generate JWTs
    creatorUser = await prisma.user.findUnique({ where: { email: 'creator@tooltoll.com' } });
    assert.ok(creatorUser, 'Creator user must exist');
    creatorToken = generateJwtToken({
      userId: creatorUser.id,
      email: creatorUser.email,
      isCreator: creatorUser.isCreator,
      isConsumer: creatorUser.isConsumer,
      isAdmin: creatorUser.isAdmin,
    });

    unauthorizedUser = await prisma.user.findUnique({ where: { email: 'consumer@tooltoll.com' } });
    assert.ok(unauthorizedUser, 'Consumer user must exist');
    unauthorizedToken = generateJwtToken({
      userId: unauthorizedUser.id,
      email: unauthorizedUser.email,
      isCreator: false,
      isConsumer: true,
      isAdmin: false,
    });

    adminUser = await prisma.user.findUnique({ where: { email: 'admin@tooltoll.com' } });
    assert.ok(adminUser, 'Admin user must exist');
    adminToken = generateJwtToken({
      userId: adminUser.id,
      email: adminUser.email,
      isCreator: adminUser.isCreator,
      isConsumer: adminUser.isConsumer,
      isAdmin: adminUser.isAdmin,
    });

    consumerUser = await prisma.user.findUnique({
      where: { email: 'consumer@tooltoll.com' },
      include: { wallet: true },
    });
    assert.ok(consumerUser?.wallet, 'Consumer wallet must exist');

    // 3. Valid OpenAPI 3.0 specification pointing to test server port
    validSpecYaml = `
openapi: 3.0.0
info:
  title: "E2E Neural Translation & Linguistics Engine"
  version: "2.1.0"
  description: "Enterprise multi-lingual language translation and neural NLP services"
servers:
  - url: "http://127.0.0.1:${serverPort}"
paths:
  /api/demo/translate:
    post:
      summary: "Neural Text Translation"
      description: "Translates given source text to target language"
      operationId: "translateText"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - text
              properties:
                text:
                  type: string
                  example: "Hello world from APIMatic and Postman"
                targetLanguage:
                  type: string
                  example: "es"
      responses:
        "200":
          description: "Successful translation"
          content:
            application/json:
              schema:
                type: object
                required:
                  - translatedText
                properties:
                  translatedText:
                    type: string
                  detectedSourceLanguage:
                    type: string
`;

    // 4. Intentionally corrupted specification (syntax error)
    invalidSpecYaml = '{ "openapi": "3.0.0", "info": { "title": "Broken Spec Unclosed';
  });

  after(async () => {
    if (testServer) {
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
    }
  });

  // =========================================================================
  // STEP 1 - 3: APIMATIC SPECIFICATION UPLOAD & VALIDATION REPORT
  // =========================================================================
  it('STEP 1 - 3 (Error Case): APIMatic rejects intentionally invalid specification', async () => {
    const res = await request(app)
      .post('/api/onboarding/validate')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ specContent: invalidSpecYaml });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.report.isValid, false, 'Invalid spec must be marked as invalid');
    assert.equal(res.body.data.report.status, 'INVALID');
    assert.equal(res.body.data.draft, null, 'No draft configuration created for invalid spec');
    assert.ok(
      res.body.data.report.errors.some((e: any) => e.code === 'ERR_SYNTAX_INVALID'),
      'Report must contain ERR_SYNTAX_INVALID code'
    );
  });

  it('STEP 1 - 3 (Success Case): Creator uploads valid OpenAPI spec; APIMatic validates and generates report', async () => {
    const res = await request(app)
      .post('/api/onboarding/validate')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ specContent: validSpecYaml });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const { report, draft } = res.body.data;
    assert.equal(report.isValid, true);
    assert.equal(report.status, 'VALID');
    assert.equal(report.summary.errorsCount, 0);
    assert.ok(report.successfulChecks.length > 0);

    // Converted draft inspection
    assert.equal(draft.name, 'E2E Neural Translation & Linguistics Engine');
    assert.equal(draft.baseUrl, `http://127.0.0.1:${serverPort}`);
    assert.equal(draft.endpoints.length, 1);
    assert.equal(draft.endpoints[0].path, '/api/demo/translate');
    assert.equal(draft.endpoints[0].method, 'POST');
    assert.ok(draft.endpoints[0].hasInputSchema);
    assert.ok(draft.endpoints[0].hasOutputSchema);
  });

  // =========================================================================
  // STEP 4 - 5: CREATOR REVIEWS, APPROVES & PERSISTS IN POSTGRESQL (DRAFT)
  // =========================================================================
  it('STEP 4 - 5: Creator configures pricing and approves registration -> Saved in PostgreSQL in DRAFT status', async () => {
    const confirmRes = await request(app)
      .post('/api/onboarding/confirm')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        name: 'E2E Neural Translation Engine',
        shortDescription: 'Validated via APIMatic, tested via Postman',
        detailedDescription: 'Full production-ready translation API onboarded and tested seamlessly.',
        category: 'NLP',
        baseUrl: `http://127.0.0.1:${serverPort}`,
        authMethod: 'API_KEY_HEADER',
        authHeaderName: 'X-API-Key',
        upstreamSecret: 'test-secret-neural-key',
        priceMicroUsd: '7500',
        timeoutMs: 12000,
        endpoints: [
          {
            name: 'Translate Text',
            endpointPath: '/api/demo/translate',
            httpMethod: 'POST',
            priceMicroUsd: '7500',
            timeoutMs: 12000,
            inputSchema: {
              type: 'object',
              required: ['text'],
              properties: { text: { type: 'string' } },
            },
            outputSchema: {
              type: 'object',
              required: ['translatedText'],
              properties: { translatedText: { type: 'string' } },
            },
            exampleRequest: { text: 'Hello world from Phase 3 E2E test' },
            exampleResponse: { translatedText: 'Hola mundo' },
            isPrimary: true,
          },
        ],
      });

    assert.equal(confirmRes.status, 201);
    assert.equal(confirmRes.body.success, true);
    onboardedToolId = confirmRes.body.data.id;
    assert.ok(onboardedToolId);

    // Verify PostgreSQL records
    const tool = await prisma.tool.findUnique({
      where: { id: onboardedToolId },
      include: { endpoints: true, versions: true },
    });

    assert.ok(tool);
    assert.equal(tool.status, 'DRAFT', 'Newly onboarded tool must be in DRAFT status');
    assert.equal(tool.creatorId, creatorUser.id, 'Creator ownership must be preserved');
    assert.equal(tool.version, 1);
    assert.equal(tool.endpoints.length, 1);
    primaryEndpointId = tool.endpoints[0].id;

    // Invariant 8: Secret is encrypted at rest
    assert.ok(tool.encryptedSecret);
    assert.notEqual(tool.encryptedSecret, 'test-secret-neural-key');

    // Audit log created with APIMatic action
    const auditLog = await prisma.auditLog.findFirst({
      where: { resourceId: onboardedToolId, action: 'TOOL_ONBOARDED_APIMATIC' },
    });
    assert.ok(auditLog, 'Audit log must record TOOL_ONBOARDED_APIMATIC');
  });

  // =========================================================================
  // STEP 6: POSTMAN GENERATES COLLECTION & ENVIRONMENT FROM SAVED SPEC
  // =========================================================================
  it('STEP 6: Postman generates v2.1 Collection and Environment JSON referencing saved API specification', async () => {
    // 1. Postman Collection
    const colRes = await request(app)
      .get(`/api/testing/${onboardedToolId}/collection`)
      .set('Authorization', `Bearer ${creatorToken}`);

    assert.equal(colRes.status, 200);
    assert.equal(colRes.body.success, true);
    const collection = colRes.body.data;

    assert.equal(collection.info.schema, 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json');
    assert.ok(collection.info.name.includes('E2E Neural Translation Engine'));
    assert.equal(collection.variable.find((v: any) => v.key === 'baseUrl').value, `http://127.0.0.1:${serverPort}`);
    // Invariant 8: Masked secret in export
    assert.equal(collection.variable.find((v: any) => v.key === 'apiKey').value, 'YOUR_API_KEY_HERE');

    // Items contain endpoint & test script
    assert.equal(collection.item.length, 1);
    assert.equal(collection.item[0].request.method, 'POST');
    assert.ok(collection.item[0].event.some((e: any) => e.listen === 'test'));

    // 2. Postman Environment
    const envRes = await request(app)
      .get(`/api/testing/${onboardedToolId}/environment`)
      .set('Authorization', `Bearer ${creatorToken}`);

    assert.equal(envRes.status, 200);
    assert.equal(envRes.body.success, true);
    const environment = envRes.body.data;
    assert.ok(environment.values.some((v: any) => v.key === 'baseUrl'));
    assert.ok(environment.values.some((v: any) => v.key === 'apiKey'));
  });

  // =========================================================================
  // STEP 7 (FAILURE): POSTMAN RUNNER DETECTS FAILURES & PREVENTS PRE-PUB SUBMIT
  // =========================================================================
  it('STEP 7 (Failure Branch): Postman executes test with invalid input; records failure and blocks submission', async () => {
    // Missing required field 'text' -> Demo endpoint returns 400 Bad Request
    const testFailRes = await request(app)
      .post('/api/testing/run')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        toolId: onboardedToolId,
        endpointId: primaryEndpointId,
        sampleInput: { invalidKey: 'no text provided' },
      });

    assert.equal(testFailRes.status, 200);
    assert.equal(testFailRes.body.success, true);
    const report = testFailRes.body.data;
    assert.equal(report.status, 'FAILED');
    assert.equal(report.statusCode, 400);
    assert.ok(report.failedTests > 0);

    // Verify stored in PostgreSQL as failed run
    const failedRun = await prisma.toolTestRun.findFirst({
      where: { toolId: onboardedToolId, isSuccess: false },
    });
    assert.ok(failedRun, 'Failed test run must be persisted in database');

    // STEP 9 Pre-Publication Guard: Submitting without passing test must fail
    const submitFailRes = await request(app)
      .post(`/api/tools/${onboardedToolId}/submit`)
      .set('Authorization', `Bearer ${creatorToken}`);

    assert.equal(submitFailRes.status, 400);
    assert.ok(submitFailRes.body.error.message.includes('at least one successful test run'));
  });

  // =========================================================================
  // STEP 7 - 8 (SUCCESS): POSTMAN EXECUTES VALID TESTS; STORES PASSING REPORT
  // =========================================================================
  it('STEP 7 - 8 (Success Branch): Postman executes live tests; all contract assertions pass and persist in DB', async () => {
    const testPassRes = await request(app)
      .post('/api/testing/run')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        toolId: onboardedToolId,
        endpointId: primaryEndpointId,
        sampleInput: { text: 'Enterprise integration test string', targetLanguage: 'es' },
      });

    assert.equal(testPassRes.status, 200);
    assert.equal(testPassRes.body.success, true);
    const report = testPassRes.body.data;

    assert.equal(report.status, 'PASSED');
    assert.equal(report.failedTests, 0);
    assert.equal(report.statusCode, 200);
    assert.ok(report.latencyMs >= 0);
    assert.ok(report.assertions.length > 0);
    assert.ok(report.assertions.every((a: any) => a.passed === true));

    // Stored in PostgreSQL ToolTestRun with isSuccess: true
    const passRun = await prisma.toolTestRun.findFirst({
      where: { toolId: onboardedToolId, isSuccess: true },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(passRun);
    assert.equal(passRun.responseStatus, 200);

    // Verify history retrieval for Creator Studio
    const histRes = await request(app)
      .get(`/api/testing/${onboardedToolId}/history`)
      .set('Authorization', `Bearer ${creatorToken}`);

    assert.equal(histRes.status, 200);
    assert.ok(Array.isArray(histRes.body.data.history));
    assert.ok(histRes.body.data.history.length >= 2, 'History must contain both failed and passed runs');
  });

  // =========================================================================
  // STEP 9: EXISTING APPROVAL & PUBLICATION WORKFLOW
  // =========================================================================
  it('STEP 9: Creator submits tool for approval -> Transitions to PENDING_REVIEW', async () => {
    const submitRes = await request(app)
      .post(`/api/tools/${onboardedToolId}/submit`)
      .set('Authorization', `Bearer ${creatorToken}`);

    assert.equal(submitRes.status, 200);
    assert.equal(submitRes.body.success, true);
    assert.equal(submitRes.body.data.status, 'PENDING_REVIEW');

    const inDb = await prisma.tool.findUnique({ where: { id: onboardedToolId } });
    assert.equal(inDb?.status, 'PENDING_REVIEW');
  });

  it('STEP 9 (Admin Moderation): Admin approves the tool -> Transitions to APPROVED', async () => {
    const approveRes = await request(app)
      .post(`/api/admin/tools/${onboardedToolId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Passed APIMatic structure checks and Newman contract tests' });

    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.body.success, true);
    assert.equal(approveRes.body.data.status, 'APPROVED');

    const inDb = await prisma.tool.findUnique({ where: { id: onboardedToolId } });
    assert.equal(inDb?.status, 'APPROVED');

    // AdminReview table record
    const review = await prisma.adminReview.findFirst({ where: { toolId: onboardedToolId } });
    assert.ok(review);
    assert.equal(review.decision, 'APPROVED');
  });

  // =========================================================================
  // STEP 10: MARKETPLACE VISIBILITY & EXECUTION GATEWAY INTEGRATION
  // =========================================================================
  it('STEP 10 (Marketplace Discovery): Tool is publicly visible in marketplace search', async () => {
    const mktRes = await request(app).get('/api/tools');

    assert.equal(mktRes.status, 200);
    assert.equal(mktRes.body.success, true);
    const found = mktRes.body.data.find((t: any) => t.id === onboardedToolId);
    assert.ok(found, 'Newly approved API must be visible in marketplace listing');
    assert.equal(found.status, 'APPROVED');
    assert.equal(found.category, 'NLP');
  });

  it('STEP 10 (Execution Gateway & Settlement): Consumer executes paid tool call through Execution Gateway', async () => {
    const idempotencyKey = `idem_phase3_${Date.now()}`;
    const initialBalance = (await prisma.wallet.findUnique({ where: { id: consumerUser.wallet.id } }))!.balance;

    const execRes = await request(app)
      .post(`/api/tools/${onboardedToolId}/calls`)
      .set('X-Agent-Key', agentKey)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        input: { text: 'Live marketplace execution text', targetLanguage: 'es' },
      });

    assert.equal(execRes.status, 200);
    assert.equal(execRes.body.success, true);
    assert.equal(execRes.body.data.status, 'SUCCESS');
    assert.ok(execRes.body.data.callId);

    // Verify wallet deduction
    const finalBalance = (await prisma.wallet.findUnique({ where: { id: consumerUser.wallet.id } }))!.balance;
    assert.equal(initialBalance - finalBalance, BigInt(7500), '7500 micro-USD deducted');

    // Verify Idempotent replay
    const replayRes = await request(app)
      .post(`/api/tools/${onboardedToolId}/calls`)
      .set('X-Agent-Key', agentKey)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        input: { text: 'Live marketplace execution text', targetLanguage: 'es' },
      });

    assert.equal(replayRes.status, 200);
    assert.equal(replayRes.body.data.isIdempotentReplay, true);
    const balanceAfterReplay = (await prisma.wallet.findUnique({ where: { id: consumerUser.wallet.id } }))!.balance;
    assert.equal(balanceAfterReplay, finalBalance, 'No double charge on idempotent replay');
  });

  // =========================================================================
  // INTEGRATION CONSISTENCY & SECURITY INVARIANTS
  // =========================================================================
  it('Consistency: Updating endpoint resets APPROVED tool to PENDING_REVIEW for re-testing', async () => {
    const updateRes = await request(app)
      .put(`/api/tools/${onboardedToolId}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        name: 'E2E Neural Translation Engine v2',
        shortDescription: 'Updated short description',
        detailedDescription: 'Updated full description',
        category: 'NLP',
        baseUrl: `http://127.0.0.1:${serverPort}`,
        endpointPath: '/api/demo/translate-v2',
        httpMethod: 'POST',
        priceMicroUsd: 8000,
        inputSchema: { type: 'object', required: ['text'] },
      });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.status, 'PENDING_REVIEW', 'Critical schema/path update resets status to PENDING_REVIEW');
    assert.equal(updateRes.body.data.version, 2, 'Version increments to 2');
  });

  it('Security: Non-owner cannot run Postman tests on another creator API', async () => {
    const unauthTestRes = await request(app)
      .post('/api/testing/run')
      .set('Authorization', `Bearer ${unauthorizedToken}`)
      .send({
        toolId: onboardedToolId,
        endpointId: primaryEndpointId,
        sampleInput: { text: 'unauthorized call' },
      });

    assert.equal(unauthTestRes.status, 403);
    assert.equal(unauthTestRes.body.error.code, 'FORBIDDEN');
  });
});
