import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateJwtToken } from '../src/lib/auth';

describe('Phase 1: APIMatic API Onboarding & Specification Transformation', () => {
  let creatorToken: string;
  let consumerToken: string;
  let creatorId: string;
  let createdToolId: string;

  before(async () => {
    // Retrieve seeded creator and consumer
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

    const consumer = await prisma.user.findUnique({ where: { email: 'consumer@tooltoll.com' } });
    assert.ok(consumer, 'Seeded consumer must exist');

    consumerToken = generateJwtToken({
      userId: consumer.id,
      email: consumer.email,
      isCreator: consumer.isCreator,
      isConsumer: consumer.isConsumer,
      isAdmin: consumer.isAdmin,
    });
  });

  after(async () => {
    if (createdToolId) {
      await prisma.toolEndpoint.deleteMany({ where: { toolId: createdToolId } });
      await prisma.toolVersion.deleteMany({ where: { toolId: createdToolId } });
      await prisma.auditLog.deleteMany({ where: { resourceId: createdToolId } });
      await prisma.tool.deleteMany({ where: { id: createdToolId } });
    }
  });

  // 1. Valid OpenAPI JSON upload
  it('1. Valid OpenAPI JSON upload and validation', async () => {
    const validOpenApiJson = JSON.stringify({
      openapi: '3.0.0',
      info: {
        title: 'Geocoding & Weather Service',
        version: '1.2.0',
        description: 'Provides real-time atmospheric readings and geographic coordinate translation.',
      },
      servers: [{ url: 'https://weather.example.com/api' }],
      paths: {
        '/v1/current': {
          get: {
            summary: 'Get current weather',
            description: 'Returns real-time temperature and humidity for a latitude/longitude pair.',
            parameters: [
              { name: 'lat', in: 'query', required: true, schema: { type: 'number' } },
              { name: 'lon', in: 'query', required: true, schema: { type: 'number' } },
            ],
            responses: {
              '200': {
                description: 'Weather metrics payload',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        temp: { type: 'number' },
                        humidity: { type: 'number' },
                      },
                      required: ['temp'],
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Weather-Key',
          },
        },
      },
    });

    const res = await request(app)
      .post('/api/onboarding/validate')
      .send({ specContent: validOpenApiJson });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.report.isValid, true);
    assert.equal(res.body.data.report.status, 'VALID');
    assert.equal(res.body.data.report.summary.errorsCount, 0);
    assert.equal(res.body.data.report.summary.endpointsCount, 1);
    assert.ok(res.body.data.draft);
    assert.equal(res.body.data.draft.name, 'Geocoding & Weather Service');
    assert.equal(res.body.data.draft.baseUrl, 'https://weather.example.com/api');
    assert.equal(res.body.data.draft.authMethod, 'API_KEY_HEADER');
    assert.equal(res.body.data.draft.authHeaderName, 'X-Weather-Key');
  });

  // 2. Valid OpenAPI YAML upload
  it('2. Valid OpenAPI YAML upload and validation', async () => {
    const validOpenApiYaml = `
openapi: 3.0.0
info:
  title: "Sentiment & Text Intelligence API"
  version: "2.0.0"
  description: "AI-driven sentiment classification and named entity recognition."
servers:
  - url: "https://nlp.example.com/v2"
paths:
  /analyze:
    post:
      summary: "Analyze text sentiment"
      description: "Classifies sentiment score from -1.0 to +1.0."
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
                  description: "Input paragraph"
            example:
              text: "ToolToll makes API monetization effortless."
      responses:
        "200":
          description: "Analysis outcome"
          content:
            application/json:
              schema:
                type: object
                properties:
                  sentiment:
                    type: string
                  score:
                    type: number
`;

    const res = await request(app)
      .post('/api/onboarding/validate')
      .send({ specContent: validOpenApiYaml });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.report.isValid, true);
    assert.equal(res.body.data.draft.rawSpecFormat, 'yaml');
    assert.equal(res.body.data.draft.name, 'Sentiment & Text Intelligence API');
    assert.equal(res.body.data.draft.endpoints.length, 1);
    assert.equal(res.body.data.draft.endpoints[0].method, 'POST');
    assert.equal(res.body.data.draft.endpoints[0].path, '/analyze');
    assert.ok(res.body.data.draft.endpoints[0].hasInputSchema);
    assert.ok(res.body.data.draft.endpoints[0].hasOutputSchema);
  });

  // 3. Invalid specification (Syntax Error)
  it('3. Invalid specification rejection (Syntax Error)', async () => {
    const corruptedSpec = '{ "openapi": "3.0.0", "info": { "title": "Broken JSON'; // unclosed JSON

    const res = await request(app)
      .post('/api/onboarding/validate')
      .send({ specContent: corruptedSpec });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.report.isValid, false);
    assert.equal(res.body.data.report.status, 'INVALID');
    assert.equal(res.body.data.report.summary.errorsCount, 1);
    assert.equal(res.body.data.report.errors[0].code, 'ERR_SYNTAX_INVALID');
    assert.equal(res.body.data.draft, null);
  });

  // 4. Missing required information (missing title & unsupported version)
  it('4. Missing required information (missing version and missing info.title)', async () => {
    const missingInfoSpec = JSON.stringify({
      paths: {
        '/test': {
          get: {
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    });

    const res = await request(app)
      .post('/api/onboarding/validate')
      .send({ specContent: missingInfoSpec });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.report.isValid, false);
    assert.equal(res.body.data.report.status, 'INVALID');
    const errCodes = res.body.data.report.errors.map((e: any) => e.code);
    assert.ok(errCodes.includes('ERR_SPEC_VERSION_UNSUPPORTED'));
    assert.ok(errCodes.includes('ERR_MISSING_INFO'));
  });

  // 5. APIMatic validation warnings and suggestions
  it('5. Generates actionable warnings and suggestions for missing descriptions/responses', async () => {
    const warningSpec = JSON.stringify({
      openapi: '3.0.1',
      info: {
        title: 'Minimal API',
        version: '1.0.0',
        // Missing description
      },
      servers: [{ url: 'http://insecure-api.example.com' }], // Insecure HTTP warning
      paths: {
        '/ping': {
          get: {
            // Missing 200 response definition
            responses: {},
          },
        },
      },
    });

    const res = await request(app)
      .post('/api/onboarding/validate')
      .send({ specContent: warningSpec });

    assert.equal(res.status, 200);
    // Still valid to proceed, but contains warnings
    assert.equal(res.body.data.report.isValid, true);
    assert.equal(res.body.data.report.status, 'WARNINGS');
    assert.ok(res.body.data.report.warnings.length >= 2);

    const warnCodes = res.body.data.report.warnings.map((w: any) => w.code);
    assert.ok(warnCodes.includes('WARN_MISSING_DESCRIPTION'));
    assert.ok(warnCodes.includes('WARN_INSECURE_PROTOCOL'));
    assert.ok(warnCodes.includes('WARN_NO_SUCCESS_RESPONSE'));
  });

  // 6. Multi-endpoint extraction and structure conversion
  it('6. Successfully extracts multi-endpoint APIs with path parameters', async () => {
    const multiEndpointSpec = JSON.stringify({
      openapi: '3.0.0',
      info: {
        title: 'User Management Microservice',
        version: '1.0.0',
        description: 'Complete CRUD suite for consumer user accounts.',
      },
      servers: [{ url: 'https://users.tooltoll.com' }],
      paths: {
        '/v1/users': {
          get: {
            summary: 'List users',
            responses: { '200': { description: 'User list' } },
          },
          post: {
            summary: 'Create user',
            requestBody: {
              content: {
                'application/json': {
                  schema: { type: 'object', required: ['email'], properties: { email: { type: 'string' } } },
                },
              },
            },
            responses: { '201': { description: 'User created' } },
          },
        },
        '/v1/users/{userId}': {
          get: {
            summary: 'Get user details',
            parameters: [
              { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'User record' } },
          },
          delete: {
            summary: 'Delete user',
            parameters: [
              { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'User deleted' } },
          },
        },
      },
    });

    const res = await request(app)
      .post('/api/onboarding/validate')
      .send({ specContent: multiEndpointSpec });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.report.isValid, true);
    assert.equal(res.body.data.draft.endpoints.length, 4);
    assert.equal(res.body.data.draft.endpoints[0].isPrimary, true);
  });

  // 7 & 8: Creator editing and confirming registration
  it('7 & 8. Creator confirms registration with edited pricing and endpoints', async () => {
    const registrationPayload = {
      name: 'APIMatic Verified Geocoding Service',
      shortDescription: 'High precision latitude and longitude geocoding',
      detailedDescription: 'Full geocoding and reverse lookup API onboarded via APIMatic specification pipeline.',
      category: 'Data & Analytics',
      tags: ['geocoding', 'maps', 'location'],
      baseUrl: 'https://api.geocoding-provider.com',
      authMethod: 'API_KEY_HEADER',
      authHeaderName: 'X-Provider-Key',
      upstreamSecret: 'secret_prod_upstream_token_999',
      priceMicroUsd: '5000', // $0.005 per call
      timeoutMs: 12000,
      endpoints: [
        {
          name: 'Forward Geocode Coordinates',
          endpointPath: '/v1/forward',
          httpMethod: 'POST',
          description: 'Convert street address into coordinates',
          inputSchema: {
            type: 'object',
            required: ['address'],
            properties: { address: { type: 'string' } },
          },
          outputSchema: {
            type: 'object',
            properties: { lat: { type: 'number' }, lon: { type: 'number' } },
          },
          priceMicroUsd: '5000',
          timeoutMs: 12000,
          isPrimary: true,
        },
        {
          name: 'Reverse Geocode Address',
          endpointPath: '/v1/reverse',
          httpMethod: 'POST',
          description: 'Convert coordinates to address',
          inputSchema: {
            type: 'object',
            required: ['lat', 'lon'],
            properties: { lat: { type: 'number' }, lon: { type: 'number' } },
          },
          outputSchema: {
            type: 'object',
            properties: { formattedAddress: { type: 'string' } },
          },
          priceMicroUsd: '4000',
          timeoutMs: 10000,
          isPrimary: false,
        },
      ],
    };

    const res = await request(app)
      .post('/api/onboarding/confirm')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(registrationPayload);

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.name, 'APIMatic Verified Geocoding Service');
    assert.equal(res.body.data.status, 'DRAFT'); // Invariant 10: newly onboarded tools are always in DRAFT
    assert.equal(res.body.data.creatorId, creatorId);
    assert.equal(res.body.data.endpointCount, 2);
    assert.equal(res.body.data.priceMicroUsd, '5000');
    // Invariant 8: Secret is encrypted at rest and never returned
    assert.equal(res.body.data.upstreamSecret, undefined);
    assert.equal(res.body.data.encryptedSecret, undefined);

    createdToolId = res.body.data.id;
  });

  // 9. API persistence in PostgreSQL
  it('9. Verify database persistence in PostgreSQL (Tool, ToolEndpoint, ToolVersion, and AuditLog)', async () => {
    assert.ok(createdToolId, 'Tool ID must exist from previous step');

    const dbTool = await prisma.tool.findUnique({
      where: { id: createdToolId },
      include: { endpoints: true, versions: true },
    });

    assert.ok(dbTool);
    assert.equal(dbTool.creatorId, creatorId);
    assert.equal(dbTool.status, 'DRAFT');
    assert.equal(dbTool.priceMicroUsd, 5000n);
    assert.ok(dbTool.encryptedSecret); // Encrypted at rest
    assert.equal(dbTool.endpoints.length, 2);
    assert.equal(dbTool.versions.length, 1);

    // Verify audit log entry
    const audit = await prisma.auditLog.findFirst({
      where: { resourceId: createdToolId, action: 'TOOL_ONBOARDED_APIMATIC' },
    });
    assert.ok(audit, 'AuditLog entry must be recorded');
    assert.equal(audit.userId, creatorId);
  });

  // 10. API visibility according to publication rules (DRAFT tools hidden from public marketplace)
  it('10. Onboarded DRAFT tool is visible to owner but hidden from public marketplace', async () => {
    // Public marketplace query (should NOT include the new DRAFT tool)
    const publicRes = await request(app).get('/api/tools');
    assert.equal(publicRes.status, 200);
    const foundInPublic = publicRes.body.data.some((t: any) => t.id === createdToolId);
    assert.equal(foundInPublic, false, 'Unapproved DRAFT tool must not be exposed in public marketplace');

    // Creator query (Creator CAN see their own DRAFT tools)
    const creatorRes = await request(app)
      .get(`/api/tools?creatorId=${creatorId}`)
      .set('Authorization', `Bearer ${creatorToken}`);

    assert.equal(creatorRes.status, 200);
    const foundInCreator = creatorRes.body.data.some((t: any) => t.id === createdToolId);
    assert.equal(foundInCreator, true, 'Creator must be able to view their own DRAFT tools in Creator Studio');
  });

  // 11. Multi-Language SDK Generation (TypeScript & Python)
  it('11. Generates typed client SDKs in TypeScript and Python', async () => {
    // TypeScript SDK
    const tsRes = await request(app)
      .get(`/api/onboarding/sdk/${createdToolId}/typescript`)
      .set('Authorization', `Bearer ${creatorToken}`);

    assert.equal(tsRes.status, 200);
    assert.equal(tsRes.body.data.language, 'typescript');
    assert.ok(tsRes.body.data.filename.endsWith('.ts'));
    assert.ok(tsRes.body.data.code.includes('class'));
    assert.ok(tsRes.body.data.code.includes('forwardGeocodeCoordinates'));
    assert.ok(tsRes.body.data.code.includes('reverseGeocodeAddress'));

    // Python SDK
    const pyRes = await request(app)
      .get(`/api/onboarding/sdk/${createdToolId}/python`)
      .set('Authorization', `Bearer ${creatorToken}`);

    assert.equal(pyRes.status, 200);
    assert.equal(pyRes.body.data.language, 'python');
    assert.ok(pyRes.body.data.filename.endsWith('.py'));
    assert.ok(pyRes.body.data.code.includes('class'));
    assert.ok(pyRes.body.data.code.includes('def forward_geocode_coordinates'));
  });
});
