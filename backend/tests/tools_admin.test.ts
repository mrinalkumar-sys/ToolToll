import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateJwtToken } from '../src/lib/auth';

describe('Tool Lifecycle, Marketplace Discovery & Admin Governance', () => {
  let creatorToken: string;
  let adminToken: string;
  let createdToolId: string;

  it('Setup: Generate tokens for seeded creator and admin', async () => {
    const creator = await prisma.user.findUnique({ where: { email: 'creator@tooltoll.com' } });
    assert.ok(creator);
    creatorToken = generateJwtToken({
      userId: creator.id,
      email: creator.email,
      isCreator: creator.isCreator,
      isConsumer: creator.isConsumer,
      isAdmin: creator.isAdmin,
    });

    const admin = await prisma.user.findUnique({ where: { email: 'admin@tooltoll.com' } });
    assert.ok(admin);
    adminToken = generateJwtToken({
      userId: admin.id,
      email: admin.email,
      isCreator: admin.isCreator,
      isConsumer: admin.isConsumer,
      isAdmin: admin.isAdmin,
    });
  });

  it('POST /api/tools: Creator registers a new tool in DRAFT status with encrypted secret', async () => {
    const res = await request(app)
      .post('/api/tools')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        name: 'Custom IP Geolocation API',
        shortDescription: 'Provides geographic data for IP addresses',
        detailedDescription: 'Full detailed description of geolocation API features and latency SLAs.',
        category: 'Data',
        tags: ['ip', 'geolocation', 'data'],
        baseUrl: 'http://127.0.0.1:4000',
        endpointPath: '/api/demo/translate', // Points to local demo for testability
        httpMethod: 'POST',
        inputSchema: { type: 'object', required: ['ip'] },
        authMethod: 'API_KEY_HEADER',
        authHeaderName: 'X-API-Key',
        upstreamSecret: 'super-confidential-upstream-key',
        priceMicroUsd: 5000,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'DRAFT');
    assert.equal(res.body.data.version, 1);
    // Invariant 8: Secret is never returned
    assert.equal(res.body.data.encryptedSecret, undefined);
    assert.equal(res.body.data.upstreamSecret, undefined);

    createdToolId = res.body.data.id;
  });

  it('POST /api/tools/:id/test: Creator runs verification test call before submission', async () => {
    const res = await request(app)
      .post(`/api/tools/${createdToolId}/test`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ input: { text: 'hello', targetLanguage: 'es' } });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.isSuccess, true);
    assert.ok(res.body.data.testRunId);
  });

  it('POST /api/tools/:id/submit: Creator submits tool for admin review', async () => {
    const res = await request(app)
      .post(`/api/tools/${createdToolId}/submit`)
      .set('Authorization', `Bearer ${creatorToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'PENDING_REVIEW');
  });

  it('GET /api/admin/tools/pending: Admin views pending moderation queue without secrets', async () => {
    const res = await request(app)
      .get('/api/admin/tools/pending')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    const found = res.body.data.find((t: any) => t.id === createdToolId);
    assert.ok(found);
    assert.equal(found.status, 'PENDING_REVIEW');
    assert.equal(found.encryptedSecret, undefined);
  });

  it('POST /api/admin/tools/:id/approve: Admin approves tool into marketplace', async () => {
    const res = await request(app)
      .post(`/api/admin/tools/${createdToolId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Verified input schema, valid test run, approved for marketplace' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'APPROVED');
  });

  it('GET /api/tools/search: Hybrid discovery ranks tools by query and price', async () => {
    const res = await request(app)
      .get('/api/tools/search')
      .query({ query: 'translate' });

    assert.equal(res.status, 200);
    assert.ok(res.body.data.length > 0);
    assert.ok(res.body.data[0].rankingScore > 0);
  });

  it('PUT /api/tools/:id: Price change increments version and records ToolVersion history', async () => {
    const res = await request(app)
      .put(`/api/tools/${createdToolId}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        priceMicroUsd: 7500, // Update price
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.version, 2);
    assert.equal(res.body.data.priceMicroUsd, '7500');

    // Verify historical version in DB
    const versions = await prisma.toolVersion.findMany({
      where: { toolId: createdToolId },
      orderBy: { version: 'asc' },
    });

    assert.equal(versions.length, 2);
    assert.equal(versions[0].priceMicroUsd, 5000n);
    assert.equal(versions[1].priceMicroUsd, 7500n);
  });

  it('GET /api/admin/reconciliation: Generates financial balance report', async () => {
    const res = await request(app)
      .get('/api/admin/reconciliation')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.data.totalSystemLiabilitiesMicroUsd);
    assert.ok('isBalanced' in res.body.data);
  });

  it('PUT /api/admin/commission: Updates platform fee basis points', async () => {
    const res = await request(app)
      .put('/api/admin/commission')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ platformFeeBps: 1200 }); // 12%

    assert.equal(res.status, 200);
    assert.equal(res.body.data.platformFeeBps, 1200);
  });

  // Cleanup test tool
  it('Cleanup: Remove created test tool', async () => {
    await prisma.adminReview.deleteMany({ where: { toolId: createdToolId } });
    await prisma.toolTestRun.deleteMany({ where: { toolId: createdToolId } });
    await prisma.toolVersion.deleteMany({ where: { toolId: createdToolId } });
    await prisma.tool.delete({ where: { id: createdToolId } });
  });
});
