import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateJwtToken } from '../src/lib/auth';
import { encryptSecret } from '../src/lib/crypto';

describe('Phase 2: Postman Integration & API Contract Testing', () => {
  let creatorToken: string;
  let unauthorizedToken: string;
  let creatorId: string;
  let unauthorizedId: string;
  let testServer: http.Server;
  let serverPort: number;
  let testToolId: string;
  let apimaticToolId: string;
  let authToolId: string;

  before(async () => {
    // Start real HTTP server so Newman can make outbound requests
    await new Promise<void>((resolve) => {
      testServer = app.listen(0, '127.0.0.1', () => {
        serverPort = (testServer.address() as any).port;
        resolve();
      });
    });

    // Seeded creator
    const creator = await prisma.user.findUnique({ where: { email: 'creator@tooltoll.com' } });
    assert.ok(creator, 'Seeded creator must exist');
    creatorId = creator.id;

    creatorToken = generateJwtToken({
      userId: creator.id,
      email: creator.email,
      isCreator: creator.isCreator,
      isConsumer: creator.isConsumer,
      isAdmin: creator.isAdmin,
    });

    // Seeded consumer (unauthorized as creator for this tool)
    const consumer = await prisma.user.findUnique({ where: { email: 'consumer@tooltoll.com' } });
    assert.ok(consumer, 'Seeded consumer must exist');
    unauthorizedId = consumer.id;

    unauthorizedToken = generateJwtToken({
      userId: consumer.id,
      email: consumer.email,
      isCreator: false,
      isConsumer: true,
      isAdmin: false,
    });

    // Create a registered test tool pointing to local demo endpoint
    const tool = await prisma.tool.create({
      data: {
        creatorId,
        name: 'Demo Translation API',
        slug: `test-translation-api-${Date.now()}`,
        shortDescription: 'Local translation tool for Postman testing',
        detailedDescription: 'Provides automated translation testing via Postman/Newman',
        category: 'Language',
        baseUrl: `http://127.0.0.1:${serverPort}`,
        endpointPath: '/api/demo/translate',
        httpMethod: 'POST',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', example: 'hello world' },
            targetLanguage: { type: 'string', example: 'es' },
          },
          required: ['text', 'targetLanguage'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            originalText: { type: 'string' },
            translatedText: { type: 'string' },
            targetLanguage: { type: 'string' },
          },
          required: ['translatedText', 'originalText'],
        },
        exampleRequest: { text: 'hello world', targetLanguage: 'es' },
        exampleResponse: { originalText: 'hello world', translatedText: 'hola mundo', targetLanguage: 'es' },
        authMethod: 'NONE',
        priceMicroUsd: 1000n,
        timeoutMs: 8000,
        status: 'DRAFT',
        isDemo: true, // Allows localhost destination under SSRF policy
      },
    });
    testToolId = tool.id;

    // Create an endpoint under the tool
    await prisma.toolEndpoint.create({
      data: {
        toolId: tool.id,
        name: 'Translate Text',
        endpointPath: '/api/demo/translate',
        httpMethod: 'POST',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            targetLanguage: { type: 'string' },
          },
          required: ['text', 'targetLanguage'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            translatedText: { type: 'string' },
          },
          required: ['translatedText'],
        },
        exampleRequest: { text: 'thank you', targetLanguage: 'es' },
        authMethod: 'NONE',
        priceMicroUsd: 1000n,
        isPrimary: true,
      },
    });

    // Create an authenticated tool to test auth handling
    const enc = encryptSecret('invalid-mock-token');
    const authTool = await prisma.tool.create({
      data: {
        creatorId,
        name: 'Auth Protected API',
        slug: `test-auth-api-${Date.now()}`,
        shortDescription: 'Requires API key',
        detailedDescription: 'Testing authentication failures with Postman',
        category: 'Security',
        baseUrl: `http://127.0.0.1:${serverPort}`,
        endpointPath: '/api/creator/earnings', // Express route requiring auth
        httpMethod: 'GET',
        inputSchema: {},
        authMethod: 'BEARER_TOKEN',
        encryptedSecret: enc.encrypted,
        secretKeyVersion: enc.keyVersion,
        priceMicroUsd: 1000n,
        timeoutMs: 5000,
        status: 'DRAFT',
        isDemo: true,
      },
    });
    authToolId = authTool.id;
  });

  after(async () => {
    // Clean up test tools
    for (const id of [testToolId, apimaticToolId, authToolId]) {
      if (id) {
        await prisma.toolTestRun.deleteMany({ where: { toolId: id } });
        await prisma.toolEndpoint.deleteMany({ where: { toolId: id } });
        await prisma.toolVersion.deleteMany({ where: { toolId: id } });
        await prisma.auditLog.deleteMany({ where: { resourceId: id } });
        await prisma.tool.deleteMany({ where: { id } }).catch(() => {});
      }
    }

    if (testServer) {
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
    }
  });

  // 1. Postman Collection Generation (v2.1 Schema Compliance)
  it('1. Generates valid Postman Collection v2.1 with variables and assertions', async () => {
    const res = await request(app)
      .get(`/api/testing/${testToolId}/collection`)
      .set('Authorization', `Bearer ${creatorToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const collection = res.body.data;
    assert.equal(collection.info.schema, 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json');
    assert.ok(collection.info.name.includes('Demo Translation API'));
    assert.ok(Array.isArray(collection.item));
    assert.ok(collection.item.length > 0);

    const firstItem = collection.item[0];
    assert.equal(firstItem.request.method, 'POST');
    assert.ok(firstItem.event && firstItem.event.length > 0);
    assert.equal(firstItem.event[0].listen, 'test');
    assert.ok(firstItem.event[0].script.exec.some((line: string) => line.includes('pm.test')));

    // Invariant 8: Secret is masked
    const apiKeyVar = collection.variable.find((v: any) => v.key === 'apiKey');
    assert.ok(apiKeyVar);
    assert.equal(apiKeyVar.value, 'YOUR_API_KEY_HERE');
  });

  // 2. Postman Environment Generation
  it('2. Generates valid Postman Environment JSON', async () => {
    const res = await request(app)
      .get(`/api/testing/${testToolId}/environment`)
      .set('Authorization', `Bearer ${creatorToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const envData = res.body.data;
    assert.equal(envData._postman_variable_scope, 'environment');
    assert.ok(envData.values.some((v: any) => v.key === 'baseUrl'));
    assert.ok(envData.values.some((v: any) => v.key === 'apiKey'));
  });

  // 3. Valid API Execution via Postman / Newman
  it('3. Executes valid API tests with Postman engine and returns passing report', async () => {
    const res = await request(app)
      .post('/api/testing/run')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        toolId: testToolId,
        sampleInput: { text: 'hello world', targetLanguage: 'es' },
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const report = res.body.data;
    assert.equal(report.status, 'PASSED');
    assert.equal(report.statusCode, 200);
    assert.ok(report.latencyMs > 0);
    assert.ok(report.totalTests >= 4);
    assert.equal(report.failedTests, 0);
    assert.equal(report.passedTests, report.totalTests);
    assert.ok(Array.isArray(report.assertions));
    assert.ok(report.assertions.every((a: any) => a.passed === true));
  });

  // 4. Failed API Execution Handling
  it('4. Handles endpoint errors and records failure in Postman test report', async () => {
    // Non-existent route on server
    const invalidTool = await prisma.tool.create({
      data: {
        creatorId,
        name: 'Broken Endpoint API',
        slug: `test-broken-api-${Date.now()}`,
        shortDescription: 'Returns 404',
        detailedDescription: 'Testing failure handling',
        category: 'Test',
        baseUrl: `http://127.0.0.1:${serverPort}`,
        endpointPath: '/api/non-existent-route-for-testing',
        httpMethod: 'POST',
        inputSchema: {},
        priceMicroUsd: 1000n,
        timeoutMs: 5000,
        status: 'DRAFT',
        isDemo: true,
      },
    });

    const res = await request(app)
      .post('/api/testing/run')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        toolId: invalidTool.id,
      });

    assert.equal(res.status, 200);
    const report = res.body.data;
    assert.equal(report.status, 'FAILED');
    assert.equal(report.statusCode, 404);
    assert.ok(report.failedTests > 0);

    // Clean up
    await prisma.toolTestRun.deleteMany({ where: { toolId: invalidTool.id } });
    await prisma.tool.delete({ where: { id: invalidTool.id } });
  });

  // 5. Input Parameter Validation Failure
  it('5. Detects parameter validation failures via Postman contract tests', async () => {
    // Pass empty string which fails demoTools validation (min 1 required)
    const res = await request(app)
      .post('/api/testing/run')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        toolId: testToolId,
        sampleInput: { text: '', targetLanguage: '' },
      });

    assert.equal(res.status, 200);
    const report = res.body.data;
    assert.equal(report.status, 'FAILED');
    assert.equal(report.statusCode, 400); // Bad Request from demo validator
    assert.ok(report.failedTests > 0);
  });

  // 6. Response Schema Consistency Test
  it('6. Verifies response schema assertions (required fields and types)', async () => {
    const res = await request(app)
      .post('/api/testing/run')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        toolId: testToolId,
        sampleInput: { text: 'thank you', targetLanguage: 'es' },
      });

    assert.equal(res.status, 200);
    const report = res.body.data;
    assert.equal(report.status, 'PASSED');

    // Check that schema assertions ran
    const requiredFieldAssertion = report.assertions.find((a: any) =>
      a.name.includes('Response contains required field: translatedText')
    );
    assert.ok(requiredFieldAssertion, 'Should assert presence of required translatedText field');
    assert.equal(requiredFieldAssertion.passed, true);
  });

  // 7. Authentication Failure Detection
  it('7. Detects authentication failure when secret is invalid', async () => {
    const res = await request(app)
      .post('/api/testing/run')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        toolId: authToolId,
      });

    assert.equal(res.status, 200);
    const report = res.body.data;
    assert.equal(report.status, 'FAILED');
    assert.equal(report.statusCode, 401); // Unauthorized from express auth
    assert.ok(report.failedTests > 0);
  });

  // 8. Database Persistence in ToolTestRun
  it('8. Persists test run results into PostgreSQL ToolTestRun table', async () => {
    const runCountBefore = await prisma.toolTestRun.count({ where: { toolId: testToolId } });

    await request(app)
      .post('/api/testing/run')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        toolId: testToolId,
        sampleInput: { text: 'world', targetLanguage: 'de' },
      });

    const runCountAfter = await prisma.toolTestRun.count({ where: { toolId: testToolId } });
    assert.equal(runCountAfter, runCountBefore + 1);

    const latestRun = await prisma.toolTestRun.findFirst({
      where: { toolId: testToolId },
      orderBy: { createdAt: 'desc' },
    });

    assert.ok(latestRun);
    assert.equal(latestRun.responseStatus, 200);
    assert.equal(latestRun.isSuccess, true);
    assert.ok(latestRun.latencyMs && latestRun.latencyMs > 0);
    assert.ok((latestRun.responseBody as any).postmanReport);
  });

  // 9. Test History Retrieval
  it('9. Retrieves historical Postman test runs for Creator Studio UI', async () => {
    const res = await request(app)
      .get(`/api/testing/${testToolId}/history`)
      .set('Authorization', `Bearer ${creatorToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.history));
    assert.ok(res.body.data.history.length > 0);

    const first = res.body.data.history[0];
    assert.ok(first.id);
    assert.equal(first.statusCode, 200);
    assert.ok(first.totalTests > 0);
    assert.ok(first.createdAt);
  });

  // 10. Unauthorized Testing Rejection (Cross-Tenant Safety)
  it('10. Prevents unauthorized users from running tests on another creator tool', async () => {
    const res = await request(app)
      .post('/api/testing/run')
      .set('Authorization', `Bearer ${unauthorizedToken}`)
      .send({
        toolId: testToolId,
      });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  // 11. Connect with APIMatic-onboarded APIs
  it('11. Reuses APIMatic-onboarded API definitions for Postman testing without duplication', async () => {
    const registrationPayload = {
      name: 'APIMatic Weather Gateway',
      shortDescription: 'Onboarded via APIMatic, tested via Postman',
      detailedDescription: 'Full weather API onboarded via APIMatic specification pipeline.',
      category: 'Weather',
      tags: ['weather', 'forecast'],
      baseUrl: `http://127.0.0.1:${serverPort}`,
      authMethod: 'NONE',
      priceMicroUsd: '1500',
      timeoutMs: 8000,
      isDemo: true,
      endpoints: [
        {
          name: 'Weather Query Translated',
          endpointPath: '/api/demo/translate',
          httpMethod: 'POST',
          description: 'Query weather information',
          inputSchema: {
            type: 'object',
            properties: {
              text: { type: 'string', example: 'hello' },
              targetLanguage: { type: 'string', example: 'fr' },
            },
            required: ['text', 'targetLanguage'],
          },
          outputSchema: {
            type: 'object',
            properties: { translatedText: { type: 'string' } },
            required: ['translatedText'],
          },
          priceMicroUsd: '1500',
          timeoutMs: 8000,
          isPrimary: true,
        },
      ],
    };

    // Onboard via Phase 1 endpoint
    const confirmRes = await request(app)
      .post('/api/onboarding/confirm')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(registrationPayload);

    assert.equal(confirmRes.status, 201);
    apimaticToolId = confirmRes.body.data.id;
    assert.ok(apimaticToolId);

    // Immediately test via Postman testing endpoint without duplicating definitions
    const testRes = await request(app)
      .post('/api/testing/run')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        toolId: apimaticToolId,
        sampleInput: { text: 'hello', targetLanguage: 'fr' },
      });

    assert.equal(testRes.status, 200);
    assert.equal(testRes.body.success, true);

    assert.equal(testRes.body.data.status, 'PASSED');
    assert.equal(testRes.body.data.statusCode, 200);
    assert.ok(testRes.body.data.passedTests > 0);
  });
});
