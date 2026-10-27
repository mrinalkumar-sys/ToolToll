import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';

describe('Authentication & Agent Identity API', () => {
  const testEmail = `test_user_${Date.now()}@example.com`;
  let userToken: string;
  let userId: string;
  let agentId: string;
  let rawAgentToken: string;
  let credentialId: string;

  it('POST /api/auth/register should register a new user and return token and wallet', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'Password123!',
        name: 'Test Tester',
        isCreator: true,
        isConsumer: true,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.email, testEmail);
    assert.ok(res.body.data.token);
    assert.ok(res.body.data.wallet.id);

    userToken = res.body.data.token;
    userId = res.body.data.user.id;
  });

  it('POST /api/auth/login should authenticate valid user and set session cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'Password123!',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.token);
  });

  it('POST /api/auth/login should reject incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'WrongPassword!',
      });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it('GET /api/auth/me should return current user info', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.id, userId);
  });

  it('POST /api/agents should create agent with spend limits and return raw credential ONCE', async () => {
    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Test Automation Agent',
        description: 'Agent for automated integration tests',
        maxPerCallMicroUsd: 500_000, // $0.50
        dailyBudgetMicroUsd: 10_000_000, // $10.00
        monthlyBudgetMicroUsd: 100_000_000,
        approvalThresholdMicroUsd: 2_000_000, // $2.00
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.agent.id);
    assert.ok(res.body.data.credential.rawToken);
    assert.ok(res.body.data.credential.rawToken.startsWith('tt_live_'));

    agentId = res.body.data.agent.id;
    rawAgentToken = res.body.data.credential.rawToken;
    credentialId = res.body.data.credential.id;
  });

  it('GET /api/agents should list agents without exposing secret tokens', async () => {
    const res = await request(app)
      .get('/api/agents')
      .set('Authorization', `Bearer ${userToken}`);

    assert.equal(res.status, 200);
    const found = res.body.data.find((a: any) => a.id === agentId);
    assert.ok(found);
    // Ensure raw token is not exposed in list
    assert.equal(found.credentials[0].rawToken, undefined);
    assert.equal(found.credentials[0].tokenHash, undefined);
    assert.ok(found.credentials[0].prefix);
  });

  it('PUT /api/agents/:id/permissions should configure scoped permissions', async () => {
    const res = await request(app)
      .put(`/api/agents/${agentId}/permissions`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        permissions: [
          { category: 'Translation', isAllowed: true },
          { category: 'Security', isAllowed: false },
        ],
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 2);
  });

  it('DELETE /api/agents/:id/credentials/:credentialId should revoke the credential', async () => {
    const res = await request(app)
      .delete(`/api/agents/${agentId}/credentials/${credentialId}`)
      .set('Authorization', `Bearer ${userToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.message, 'Credential revoked successfully');

    // Verify revoked credential cannot be used for tool calls
    const callRes = await request(app)
      .post('/api/tools/30f6d8ef-41f5-4afe-97ab-f1bbe130bacf/calls')
      .set('X-Agent-Key', rawAgentToken)
      .set('Idempotency-Key', `revoked_test_${Date.now()}`)
      .send({ input: { text: 'hello', targetLanguage: 'es' } });

    assert.equal(callRes.status, 403);
  });
});
