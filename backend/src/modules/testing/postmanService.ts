import newman from 'newman';
import { request } from 'undici';
import { prisma } from '../../lib/prisma';
import { validateOutboundUrl } from '../../lib/ssrf';
import { decryptSecret } from '../../lib/crypto';
import { env } from '../../config/env';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/errors';

export interface PostmanAssertionResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface PostmanTestReport {
  testRunId: string;
  toolId: string;
  toolName: string;
  endpointId?: string | null;
  endpointName?: string | null;
  httpMethod: string;
  endpointPath: string;
  targetUrl: string;
  status: 'PASSED' | 'FAILED' | 'ERROR';
  statusCode: number;
  latencyMs: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  assertions: PostmanAssertionResult[];
  responseBody: unknown;
  errorMessage?: string;
  executedAt: string;
}

export interface RunPostmanTestParams {
  toolId: string;
  endpointId?: string;
  sampleInput?: Record<string, unknown>;
  userId: string;
  isAdmin?: boolean;
}

/**
 * Synthesizes a valid sample input object based on an OpenAPI / JSON Schema definition
 */
function synthesizeSampleInput(schema: any): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return {};
  if (schema.example && typeof schema.example === 'object') return schema.example;

  const result: Record<string, unknown> = {};
  const props = schema.properties || {};

  for (const [key, prop] of Object.entries<any>(props)) {
    if (prop.example !== undefined) {
      result[key] = prop.example;
    } else if (prop.default !== undefined) {
      result[key] = prop.default;
    } else if (prop.type === 'string') {
      result[key] = prop.format === 'email' ? 'test@example.com' : 'sample_text';
    } else if (prop.type === 'number' || prop.type === 'integer') {
      result[key] = 1;
    } else if (prop.type === 'boolean') {
      result[key] = true;
    } else if (prop.type === 'array') {
      result[key] = [];
    } else if (prop.type === 'object') {
      result[key] = {};
    } else {
      result[key] = 'sample_value';
    }
  }

  return result;
}

/**
 * Builds test assertion scripts in JavaScript for Postman/Newman sandbox
 */
function buildPostmanTestScripts(options: {
  slaMs: number;
  outputSchema?: any;
  exampleResponse?: any;
}): string[] {
  const scripts: string[] = [
    'pm.test("Status code is 2xx success", function () {',
    '    pm.response.to.be.success;',
    '});',
    `pm.test("Response time is within SLA (< ${options.slaMs}ms)", function () {`,
    `    pm.expect(pm.response.responseTime).to.be.below(${options.slaMs + 2000});`,
    '});',
    'pm.test("Content-Type is JSON", function () {',
    '    pm.expect(pm.response.headers.get("content-type")).to.include("application/json");',
    '});',
    'pm.test("Response body is valid JSON", function () {',
    '    var jsonData = pm.response.json();',
    '    pm.expect(jsonData).to.be.an("object");',
    '});',
  ];

  // If outputSchema has required fields, add assertions for them
  if (options.outputSchema && typeof options.outputSchema === 'object') {
    const requiredFields = Array.isArray(options.outputSchema.required)
      ? options.outputSchema.required
      : [];

    for (const field of requiredFields) {
      scripts.push(
        `pm.test("Response contains required field: ${field}", function () {`,
        '    var jsonData = pm.response.json();',
        '    var payload = jsonData && jsonData.data !== undefined ? jsonData.data : jsonData;',
        `    pm.expect(payload).to.have.property("${field}");`,
        '});'
      );
    }

    // If properties specify types
    const properties = options.outputSchema.properties || {};
    for (const [propName, propDef] of Object.entries<any>(properties)) {
      if (propDef && propDef.type && requiredFields.includes(propName)) {
        const expectedType = propDef.type === 'integer' ? 'number' : propDef.type;
        scripts.push(
          `pm.test("Field '${propName}' is type ${expectedType}", function () {`,
          '    var jsonData = pm.response.json();',
          '    var payload = jsonData && jsonData.data !== undefined ? jsonData.data : jsonData;',
          `    pm.expect(typeof payload["${propName}"]).to.eql("${expectedType}");`,
          '});'
        );
      }
    }
  }

  return scripts;
}

/**
 * Generates Postman Collection v2.1.0 format
 */
export async function generatePostmanCollection(
  toolId: string,
  endpointId?: string,
  customInput?: Record<string, unknown>,
  maskSecrets = true
): Promise<any> {
  const tool = await prisma.tool.findUnique({
    where: { id: toolId },
    include: { endpoints: true },
  });

  if (!tool) {
    throw new NotFoundError('API service not found');
  }

  // Filter endpoints if a specific one was requested
  const targetEndpoints = endpointId
    ? tool.endpoints.filter((e) => e.id === endpointId)
    : tool.endpoints;

  // If no endpoints registered in table, synthesize one from tool base definition
  const endpointsToInclude = targetEndpoints.length > 0
    ? targetEndpoints
    : [
        {
          id: tool.id,
          name: tool.name,
          endpointPath: tool.endpointPath,
          httpMethod: tool.httpMethod,
          description: tool.shortDescription,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          exampleRequest: tool.exampleRequest,
          exampleResponse: tool.exampleResponse,
          authMethod: tool.authMethod,
          authHeaderName: tool.authHeaderName,
          encryptedSecret: tool.encryptedSecret,
          timeoutMs: tool.timeoutMs,
        },
      ];

  const items = endpointsToInclude.map((ep) => {
    const effectiveAuth = ep.authMethod || tool.authMethod;
    const effectiveHeader = ep.authHeaderName || tool.authHeaderName || 'X-API-Key';
    const effectiveTimeout = ep.timeoutMs || tool.timeoutMs || 15000;

    const headers: Array<{ key: string; value: string; type: string }> = [
      { key: 'Content-Type', value: 'application/json', type: 'text' },
      { key: 'Accept', value: 'application/json', type: 'text' },
    ];

    if (effectiveAuth === 'API_KEY_HEADER') {
      headers.push({
        key: effectiveHeader,
        value: maskSecrets ? '{{apiKey}}' : (tool.encryptedSecret ? decryptSecret(tool.encryptedSecret) : '{{apiKey}}'),
        type: 'text',
      });
    } else if (effectiveAuth === 'BEARER_TOKEN') {
      headers.push({
        key: 'Authorization',
        value: maskSecrets ? 'Bearer {{apiKey}}' : `Bearer ${tool.encryptedSecret ? decryptSecret(tool.encryptedSecret) : '{{apiKey}}'}`,
        type: 'text',
      });
    }

    const payload =
      customInput && endpointId === ep.id
        ? customInput
        : ep.exampleRequest || tool.exampleRequest || synthesizeSampleInput(ep.inputSchema || tool.inputSchema);

    const testScripts = buildPostmanTestScripts({
      slaMs: effectiveTimeout,
      outputSchema: ep.outputSchema || tool.outputSchema,
      exampleResponse: ep.exampleResponse || tool.exampleResponse,
    });

    const cleanPath = ep.endpointPath.startsWith('/') ? ep.endpointPath.slice(1) : ep.endpointPath;
    const pathSegments = cleanPath.split('/').filter(Boolean);

    return {
      name: ep.name || `${ep.httpMethod} ${ep.endpointPath}`,
      event: [
        {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: testScripts,
          },
        },
      ],
      request: {
        method: ep.httpMethod,
        header: headers,
        body: ['GET', 'HEAD'].includes(ep.httpMethod.toUpperCase())
          ? undefined
          : {
              mode: 'raw',
              raw: JSON.stringify(payload, null, 2),
              options: {
                raw: {
                  language: 'json',
                },
              },
            },
        url: maskSecrets
          ? `{{baseUrl}}${ep.endpointPath.startsWith('/') ? ep.endpointPath : '/' + ep.endpointPath}`
          : new URL(ep.endpointPath.startsWith('/') ? ep.endpointPath : '/' + ep.endpointPath, tool.baseUrl).toString(),
        description: ep.description || `Execute ${ep.httpMethod} ${ep.endpointPath}`,
      },
      response: [],
    };
  });

  return {
    info: {
      _postman_id: tool.id,
      name: `${tool.name} - Postman Test Suite`,
      description: tool.detailedDescription || tool.shortDescription || 'Generated from ToolToll API Specification',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      _exporter_id: 'tooltoll-platform',
    },
    variable: [
      {
        key: 'baseUrl',
        value: tool.baseUrl.replace(/\/$/, ''),
        type: 'string',
      },
      {
        key: 'apiKey',
        value: maskSecrets ? 'YOUR_API_KEY_HERE' : '',
        type: 'string',
      },
    ],
    item: items,
  };
}

/**
 * Generates Postman Environment JSON v2.1 format
 */
export async function generatePostmanEnvironment(toolId: string): Promise<any> {
  const tool = await prisma.tool.findUnique({
    where: { id: toolId },
  });

  if (!tool) {
    throw new NotFoundError('API service not found');
  }

  return {
    id: `env-${tool.id}`,
    name: `${tool.name} Environment`,
    values: [
      {
        key: 'baseUrl',
        value: tool.baseUrl.replace(/\/$/, ''),
        type: 'default',
        enabled: true,
      },
      {
        key: 'apiKey',
        value: 'YOUR_API_KEY_HERE',
        type: 'secret',
        enabled: true,
      },
    ],
    _postman_variable_scope: 'environment',
    _postman_exported_at: new Date().toISOString(),
    _postman_exported_using: 'ToolToll Postman Integration',
  };
}

/**
 * Executes API tests using Newman engine with Postman assertion evaluation
 */
export async function runPostmanTests(params: RunPostmanTestParams): Promise<PostmanTestReport> {
  const tool = await prisma.tool.findUnique({
    where: { id: params.toolId },
    include: { endpoints: true },
  });

  if (!tool) {
    throw new NotFoundError('API service not found');
  }

  // Ownership verification
  if (tool.creatorId !== params.userId && !params.isAdmin) {
    throw new ForbiddenError('Unauthorized to run tests on this API');
  }

  // Identify target endpoint
  let targetEndpoint = params.endpointId
    ? tool.endpoints.find((e) => e.id === params.endpointId)
    : tool.endpoints[0];

  const endpointPath = targetEndpoint ? targetEndpoint.endpointPath : tool.endpointPath;
  const httpMethod = (targetEndpoint ? targetEndpoint.httpMethod : tool.httpMethod).toUpperCase();
  const endpointName = targetEndpoint ? targetEndpoint.name : tool.name;
  const timeoutMs = targetEndpoint?.timeoutMs || tool.timeoutMs || 15000;
  const effectiveTimeout = Math.min(timeoutMs, env.TOOL_EXECUTION_TIMEOUT_MS);

  // SSRF Protection Check
  const fullUrl = new URL(endpointPath, tool.baseUrl).toString();
  const validatedTarget = await validateOutboundUrl(fullUrl, tool.isDemo);

  // Prepare input payload
  const sampleInput =
    params.sampleInput ||
    targetEndpoint?.exampleRequest ||
    tool.exampleRequest ||
    synthesizeSampleInput(targetEndpoint?.inputSchema || tool.inputSchema);

  // Decrypt secret if required for live execution
  const effectiveAuth = targetEndpoint?.authMethod || tool.authMethod;
  const effectiveHeader = targetEndpoint?.authHeaderName || tool.authHeaderName || 'X-API-Key';
  const encryptedSecret = targetEndpoint?.encryptedSecret || tool.encryptedSecret;

  let plainSecret: string | undefined;
  if (encryptedSecret) {
    plainSecret = decryptSecret(encryptedSecret);
  }

  // Build Collection for Newman
  const collectionJson = await generatePostmanCollection(
    tool.id,
    targetEndpoint?.id,
    sampleInput as Record<string, unknown>,
    false // don't mask secret for internal test run
  );

  // Substitute real values for Newman execution
  const environmentJson = {
    id: `run-env-${Date.now()}`,
    name: 'Newman Test Runner Environment',
    values: [
      { key: 'baseUrl', value: tool.baseUrl.replace(/\/$/, ''), enabled: true },
      { key: 'apiKey', value: plainSecret || '', enabled: true },
    ],
  };

  // Run collection using Newman
  const startTime = Date.now();
  let statusCode = 0;
  let latencyMs = 0;
  let responseBody: any = null;
  let assertions: PostmanAssertionResult[] = [];
  let testError: string | undefined;

  try {
    const summary = await new Promise<newman.NewmanRunSummary>((resolve, reject) => {
      newman.run(
        {
          collection: collectionJson,
          environment: environmentJson,
          timeoutRequest: effectiveTimeout,
          insecure: true,
        },
        (err, summary) => {
          if (err) return reject(err);
          resolve(summary);
        }
      );
    });

    latencyMs = Date.now() - startTime;

    const executions = summary.run.executions || [];
    const mainExec = executions[0];

    if (mainExec) {
      if (mainExec.response) {
        statusCode = mainExec.response.code;
        try {
          const raw = mainExec.response.stream ? mainExec.response.stream.toString() : '';
          responseBody = raw ? JSON.parse(raw) : null;
        } catch {
          responseBody = mainExec.response.stream ? mainExec.response.stream.toString().substring(0, 500) : null;
        }
      }

      if (mainExec.assertions) {
        assertions = mainExec.assertions.map((a) => ({
          name: a.assertion,
          passed: !a.error,
          error: a.error ? a.error.message : undefined,
        }));
      }
    }

    // Check if summary had failures
    if (summary.run.failures && summary.run.failures.length > 0) {
      const topFailure = summary.run.failures[0];
      testError = topFailure.error ? topFailure.error.message : 'Test assertion failed';
    }
  } catch (newmanErr: any) {
    latencyMs = Date.now() - startTime;
    testError = newmanErr.message || 'Newman execution encountered an error';
  }

  // Determine overall test status
  const failedTests = assertions.filter((a) => !a.passed).length;
  const passedTests = assertions.filter((a) => a.passed).length;
  const totalTests = assertions.length;

  let overallStatus: 'PASSED' | 'FAILED' | 'ERROR' = 'PASSED';
  if (testError && statusCode === 0) {
    overallStatus = 'ERROR';
  } else if (failedTests > 0 || statusCode < 200 || statusCode >= 400) {
    overallStatus = 'FAILED';
  }

  const isSuccess = overallStatus === 'PASSED';

  // Persist test result in PostgreSQL ToolTestRun table
  const testRun = await prisma.toolTestRun.create({
    data: {
      toolId: tool.id,
      endpointId: targetEndpoint?.id || null,
      sampleInput: sampleInput as any,
      responseStatus: statusCode || 500,
      responseBody: {
        postmanReport: {
          totalTests,
          passedTests,
          failedTests,
          assertions,
        },
        rawResponse: responseBody,
      } as any,
      latencyMs,
      isSuccess,
      errorMessage: testError || (failedTests > 0 ? `${failedTests} assertion(s) failed` : null),
    },
  });

  return {
    testRunId: testRun.id,
    toolId: tool.id,
    toolName: tool.name,
    endpointId: targetEndpoint?.id || null,
    endpointName,
    httpMethod,
    endpointPath,
    targetUrl: fullUrl,
    status: overallStatus,
    statusCode,
    latencyMs,
    totalTests,
    passedTests,
    failedTests,
    assertions,
    responseBody,
    errorMessage: testError || (failedTests > 0 ? `${failedTests} assertion(s) failed` : undefined),
    executedAt: testRun.createdAt.toISOString(),
  };
}

/**
 * Retrieves historical test runs for a given tool
 */
export async function getTestHistory(toolId: string, limit = 20) {
  const tool = await prisma.tool.findUnique({
    where: { id: toolId },
  });

  if (!tool) {
    throw new NotFoundError('API service not found');
  }

  const runs = await prisma.toolTestRun.findMany({
    where: { toolId },
    include: { endpoint: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return runs.map((run) => {
    const bodyObj = (run.responseBody as any) || {};
    const postmanReport = bodyObj.postmanReport || {};

    return {
      id: run.id,
      endpointId: run.endpointId,
      endpointName: run.endpoint?.name || 'Primary Endpoint',
      httpMethod: run.endpoint?.httpMethod || tool.httpMethod,
      endpointPath: run.endpoint?.endpointPath || tool.endpointPath,
      statusCode: run.responseStatus,
      latencyMs: run.latencyMs,
      isSuccess: run.isSuccess,
      errorMessage: run.errorMessage,
      sampleInput: run.sampleInput,
      totalTests: postmanReport.totalTests ?? (run.isSuccess ? 1 : 0),
      passedTests: postmanReport.passedTests ?? (run.isSuccess ? 1 : 0),
      failedTests: postmanReport.failedTests ?? (run.isSuccess ? 0 : 1),
      assertions: postmanReport.assertions || [],
      createdAt: run.createdAt,
    };
  });
}

/**
 * Syncs generated collection to Postman Cloud API if POSTMAN_API_KEY is configured
 */
export async function syncCollectionToPostman(toolId: string, workspaceId?: string) {
  if (!env.POSTMAN_API_KEY) {
    return {
      synced: false,
      message: 'POSTMAN_API_KEY is not configured on the server. Postman tests run locally with Newman.',
    };
  }

  const collection = await generatePostmanCollection(toolId);

  const url = new URL('/collections', env.POSTMAN_BASE_URL);
  if (workspaceId) {
    url.searchParams.set('workspace', workspaceId);
  }

  try {
    const res = await request(url.toString(), {
      method: 'POST',
      headers: {
        'X-Api-Key': env.POSTMAN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ collection }),
    } as any);

    const data = (await res.body.json()) as any;

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return {
        synced: true,
        collectionId: data.collection?.id,
        collectionUid: data.collection?.uid,
        name: data.collection?.name,
      };
    } else {
      return {
        synced: false,
        message: data.error?.message || `Postman Cloud API returned status ${res.statusCode}`,
      };
    }
  } catch (err: any) {
    return {
      synced: false,
      message: `Failed to connect to Postman Cloud API: ${err.message}`,
    };
  }
}
