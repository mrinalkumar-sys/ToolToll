import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateJwtToken } from '../src/lib/auth';

describe('Security Controls & Bugfix Verifications (Tools, Admin, Payments, Ledger)', () => {
  let creatorToken: string;
  let consumerToken: string;
  let adminToken: string;
  let creatorUserId: string;
  let consumerUserId: string;
  let consumerAgentId: string;
  let testToolId: string;

  it('Setup: Retrieve users, agents, and generate JWT tokens', async () => {
    const creator = await prisma.user.findUnique({ where: { email: 'creator@tooltoll.com' } });
    assert.ok(creator);
    creatorUserId = creator.id;
    creatorToken = generateJwtToken({
      userId: creator.id,
      email: creator.email,
      isCreator: creator.isCreator,
      isConsumer: creator.isConsumer,
      isAdmin: creator.isAdmin,
    });

    const consumer = await prisma.user.findUnique({
      where: { email: 'consumer@tooltoll.com' },
      include: { agents: true },
    });
    assert.ok(consumer);
    consumerUserId = consumer.id;
    consumerAgentId = consumer.agents[0].id;
    consumerToken = generateJwtToken({
      userId: consumer.id,
      email: consumer.email,
      isCreator: consumer.isCreator,
      isConsumer: consumer.isConsumer,
      isAdmin: consumer.isAdmin,
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

  describe('Tool Controller: Status Escalation Prevention & Permissions', () => {
    it('Creator registers tool in DRAFT status', async () => {
      const res = await request(app)
        .post('/api/tools')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          name: 'Security Test Tool',
          shortDescription: 'Testing permission boundaries',
          detailedDescription: 'Testing permission boundaries and status transitions',
          category: 'Security',
          baseUrl: 'http://127.0.0.1:4000',
          endpointPath: '/api/demo/sentiment',
          inputSchema: { type: 'object', required: ['text'] },
          priceMicroUsd: 1500,
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.status, 'DRAFT');
      testToolId = res.body.data.id;
    });

    it('BUGFIX: Creator CANNOT bypass admin approval by setting status to APPROVED from DRAFT', async () => {
      const res = await request(app)
        .post(`/api/tools/${testToolId}/status`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ status: 'APPROVED' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);

      // Verify status in DB remains DRAFT
      const tool = await prisma.tool.findUnique({ where: { id: testToolId } });
      assert.equal(tool?.status, 'DRAFT');
    });

    it('BUGFIX: Unauthenticated or non-creator user cannot view unapproved DRAFT tool', async () => {
      // Unauthenticated
      const unauthRes = await request(app).get(`/api/tools/${testToolId}`);
      assert.equal(unauthRes.status, 404);

      // Other user (Consumer)
      const consumerRes = await request(app)
        .get(`/api/tools/${testToolId}`)
        .set('Authorization', `Bearer ${consumerToken}`);
      assert.equal(consumerRes.status, 404);

      // Owner (Creator) can view
      const ownerRes = await request(app)
        .get(`/api/tools/${testToolId}`)
        .set('Authorization', `Bearer ${creatorToken}`);
      assert.equal(ownerRes.status, 200);
      assert.equal(ownerRes.body.data.id, testToolId);
    });

    it('BUGFIX: Reject negative priceMicroUsd on tool creation', async () => {
      const res = await request(app)
        .post('/api/tools')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          name: 'Invalid Price Tool',
          shortDescription: 'Negative pricing test',
          detailedDescription: 'Negative pricing test details long enough',
          category: 'Security',
          baseUrl: 'http://127.0.0.1:4000',
          endpointPath: '/api/demo/sentiment',
          inputSchema: { type: 'object' },
          priceMicroUsd: -5000,
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('BUGFIX: Admin cannot approve a tool in DRAFT status before submission', async () => {
      const res = await request(app)
        .post(`/api/admin/tools/${testToolId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Premature approval attempt' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('Creator runs test and submits tool for admin review', async () => {
      const testRes = await request(app)
        .post(`/api/tools/${testToolId}/test`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ input: { text: 'great job' } });
      assert.equal(testRes.status, 200);
      assert.equal(testRes.body.data.isSuccess, true);

      const submitRes = await request(app)
        .post(`/api/tools/${testToolId}/submit`)
        .set('Authorization', `Bearer ${creatorToken}`);
      assert.equal(submitRes.status, 200);
      assert.equal(submitRes.body.data.status, 'PENDING_REVIEW');
    });

    it('Admin approves tool and verifies auditLog entry was generated', async () => {
      const res = await request(app)
        .post(`/api/admin/tools/${testToolId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Passed verification test, ready for marketplace' });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'APPROVED');

      // Verify audit log record exists
      const log = await prisma.auditLog.findFirst({
        where: {
          action: 'TOOL_APPROVED',
          resourceType: 'TOOL',
          resourceId: testToolId,
        },
      });
      assert.ok(log);
      assert.equal(log.action, 'TOOL_APPROVED');
    });

    it('BUGFIX: Creator can pause an APPROVED tool, and resume it back to APPROVED', async () => {
      // Pause
      const pauseRes = await request(app)
        .post(`/api/tools/${testToolId}/status`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ status: 'PAUSED' });
      assert.equal(pauseRes.status, 200);
      assert.equal(pauseRes.body.data.status, 'PAUSED');

      // Resume back to APPROVED
      const resumeRes = await request(app)
        .post(`/api/tools/${testToolId}/status`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ status: 'APPROVED' });
      assert.equal(resumeRes.status, 200);
      assert.equal(resumeRes.body.data.status, 'APPROVED');
    });

    it('BUGFIX: Editing critical endpoint on APPROVED tool resets status to PENDING_REVIEW', async () => {
      const res = await request(app)
        .put(`/api/tools/${testToolId}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          endpointPath: '/api/demo/translate', // Critical path change
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'PENDING_REVIEW');
      assert.equal(res.body.data.version, 2);

      // Re-approve for next tests
      await prisma.tool.update({ where: { id: testToolId }, data: { status: 'APPROVED' } });
    });
  });

  describe('Tool Execution: Identity Verification & Cross-Tenant Protection in /calls', () => {
    it('BUGFIX: Executing /calls without authentication token returns 401 Unauthorized', async () => {
      const res = await request(app)
        .post(`/api/tools/${testToolId}/calls`)
        .send({
          input: { text: 'test' },
          idempotencyKey: `call_unauth_${Date.now()}`,
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    it('BUGFIX: Executing /calls with invalid token returns 401 Unauthorized', async () => {
      const res = await request(app)
        .post(`/api/tools/${testToolId}/calls`)
        .set('Authorization', 'Bearer invalid_fake_jwt_token_123')
        .send({
          input: { text: 'test' },
          idempotencyKey: `call_invalid_${Date.now()}`,
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('BUGFIX: User cannot execute tool calls using another user agent ID (Cross-Tenant Theft)', async () => {
      // Creator attempts to bill Consumer's agent
      const res = await request(app)
        .post(`/api/tools/${testToolId}/calls`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          agentId: consumerAgentId, // Belongs to consumer, NOT creator!
          input: { text: 'hello world' },
          idempotencyKey: `theft_attempt_${Date.now()}`,
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('Consumer executes tool call with verified agent identity successfully', async () => {
      const res = await request(app)
        .post(`/api/tools/${testToolId}/calls`)
        .set('Authorization', `Bearer ${consumerToken}`)
        .send({
          agentId: consumerAgentId,
          input: { text: 'Hello, this is verified', targetLanguage: 'es' },
          idempotencyKey: `verified_call_${Date.now()}`,
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'SUCCESS');
      assert.ok(res.body.data.callId);

      // Verify DB record recorded the verified consumerAgentId
      const callRecord = await prisma.toolCall.findUnique({ where: { id: res.body.data.callId } });
      assert.equal(callRecord?.agentId, consumerAgentId);
    });
  });

  describe('Admin Endpoints: Robust 404 Checks & Audit Trails', () => {
    it('BUGFIX: Rejecting non-existent tool returns 404 Not Found (not 500)', async () => {
      const res = await request(app)
        .post('/api/admin/tools/00000000-0000-0000-0000-000000000000/reject')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Does not exist' });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    it('BUGFIX: Suspending non-existent tool returns 404 Not Found (not 500)', async () => {
      const res = await request(app)
        .post('/api/admin/tools/00000000-0000-0000-0000-000000000000/suspend')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Does not exist' });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    it('BUGFIX: Resolving non-existent abuse report returns 404 Not Found (not 500)', async () => {
      const res = await request(app)
        .post('/api/admin/abuse-reports/00000000-0000-0000-0000-000000000000/resolve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RESOLVED' });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    it('Admin audit log captures configuration changes and moderation decisions', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length > 0);
      const actionTypes = res.body.data.map((l: any) => l.action);
      assert.ok(actionTypes.includes('TOOL_APPROVED') || actionTypes.includes('COMMISSION_UPDATED'));
    });
  });

  describe('Safe Tool Deletion & Cleanup', () => {
    it('Creator CANNOT delete a tool that has execution call history', async () => {
      const res = await request(app)
        .delete(`/api/tools/${testToolId}`)
        .set('Authorization', `Bearer ${creatorToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.error.message, /Cannot delete a tool that has call history/);
    });

    it('Creator CAN delete a DRAFT tool that has no call history', async () => {
      // Create empty draft tool
      const createRes = await request(app)
        .post('/api/tools')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          name: 'Temporary Draft To Delete',
          shortDescription: 'Will be deleted cleanly',
          detailedDescription: 'Will be deleted cleanly without errors',
          category: 'Testing',
          baseUrl: 'http://127.0.0.1:4000',
          endpointPath: '/api/demo/translate',
          inputSchema: { type: 'object' },
          priceMicroUsd: 1000,
        });

      assert.equal(createRes.status, 201);
      const tempId = createRes.body.data.id;

      // Delete it
      const deleteRes = await request(app)
        .delete(`/api/tools/${tempId}`)
        .set('Authorization', `Bearer ${creatorToken}`);

      assert.equal(deleteRes.status, 200);
      assert.equal(deleteRes.body.success, true);

      // Verify it is gone
      const check = await prisma.tool.findUnique({ where: { id: tempId } });
      assert.equal(check, null);
    });

    it('Cleanup: Clean up testToolId records', async () => {
      await prisma.walletReservation.deleteMany({ where: { toolId: testToolId } });
      await prisma.toolCall.deleteMany({ where: { toolId: testToolId } });
      await prisma.creatorEarning.deleteMany({ where: { toolId: testToolId } });
      await prisma.adminReview.deleteMany({ where: { toolId: testToolId } });
      await prisma.toolTestRun.deleteMany({ where: { toolId: testToolId } });
      await prisma.toolVersion.deleteMany({ where: { toolId: testToolId } });
      const existingTool = await prisma.tool.findUnique({ where: { id: testToolId } });
      if (existingTool) {
        await prisma.tool.delete({ where: { id: testToolId } });
      }
    });
  });
});
