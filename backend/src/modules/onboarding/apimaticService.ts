import { request } from 'undici';
import YAML from 'yaml';
import { env } from '../../config/env';
import { validateOutboundUrl } from '../../lib/ssrf';
import { logger } from '../../config/logger';

export interface ApimaticValidationIssue {
  code: string;
  message: string;
  path?: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

export interface ApimaticEndpointSummary {
  path: string;
  method: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  exampleRequest?: Record<string, unknown>;
  exampleResponse?: Record<string, unknown>;
  authRequired: boolean;
  authType: 'NONE' | 'API_KEY_HEADER' | 'BEARER_TOKEN' | 'BASIC_AUTH';
  authHeaderName?: string;
  parametersCount: number;
  hasInputSchema: boolean;
  hasOutputSchema: boolean;
  priceMicroUsd: string;
  timeoutMs: number;
  isPrimary: boolean;
}

export interface ApimaticValidationReport {
  engine: 'apimatic_cloud' | 'apimatic_local_engine';
  engineDetails: string;
  isValid: boolean;
  status: 'VALID' | 'WARNINGS' | 'INVALID';
  specTitle: string;
  specVersion: string;
  summary: {
    totalIssues: number;
    errorsCount: number;
    warningsCount: number;
    successfulChecksCount: number;
    endpointsCount: number;
  };
  errors: ApimaticValidationIssue[];
  warnings: ApimaticValidationIssue[];
  successfulChecks: Array<{ check: string; description: string }>;
  endpointDetails: ApimaticEndpointSummary[];
  schemaIssues: Array<{ schemaName: string; issue: string; severity: 'error' | 'warning' }>;
  apimaticNotice?: string;
}

export interface ToolTollDraftConfig {
  name: string;
  slug: string;
  shortDescription: string;
  detailedDescription: string;
  category: string;
  tags: string[];
  baseUrl: string;
  endpointPath: string;
  httpMethod: string;
  authMethod: 'NONE' | 'API_KEY_HEADER' | 'BEARER_TOKEN' | 'BASIC_AUTH';
  authHeaderName?: string;
  priceMicroUsd: string;
  timeoutMs: number;
  endpoints: ApimaticEndpointSummary[];
  rawSpecFormat: 'json' | 'yaml';
  specVersion: string;
}

export interface ParseSpecInput {
  specContent?: string;
  specUrl?: string;
}

export class ApimaticService {
  /**
   * Validate an OpenAPI/Swagger specification using APIMatic Cloud (if configured)
   * or the robust ToolToll OpenAPI Validation Engine with real structural and schema analysis.
   */
  static async validateAndTransform(input: ParseSpecInput): Promise<{
    report: ApimaticValidationReport;
    draft: ToolTollDraftConfig | null;
  }> {
    let rawText = (input.specContent || '').trim();
    let sourceFormat: 'json' | 'yaml' = 'json';

    // 1. Fetch from URL if provided (SSRF Guarded)
    if (!rawText && input.specUrl) {
      try {
        const validated = await validateOutboundUrl(input.specUrl);
        const res = await request(validated.url.toString(), {
          method: 'GET',
          headers: {
            'accept': 'application/json, application/yaml, text/yaml, text/plain, */*',
            'user-agent': 'ToolToll-APIMatic-Onboarding/1.0',
          },
          bodyTimeout: 10000,
          headersTimeout: 10000,
          maxRedirections: 2,
        } as any);

        if (res.statusCode < 200 || res.statusCode >= 300) {
          return {
            report: this.createFailureReport(
              'ERR_FETCH_FAILED',
              `Failed to retrieve specification from URL (HTTP ${res.statusCode})`,
              input.specUrl,
              'Ensure the URL points directly to an accessible raw OpenAPI/Swagger JSON or YAML file.'
            ),
            draft: null,
          };
        }

        rawText = (await res.body.text()).trim();
      } catch (err: any) {
        return {
          report: this.createFailureReport(
            'ERR_URL_VALIDATION',
            `Could not access specification URL: ${err.message}`,
            input.specUrl,
            'Verify that the URL is public, accessible, and not on private internal network ranges.'
          ),
          draft: null,
        };
      }
    }

    if (!rawText) {
      return {
        report: this.createFailureReport(
          'ERR_EMPTY_SPEC',
          'Specification content is empty.',
          undefined,
          'Provide a valid OpenAPI 3.x or Swagger 2.0 JSON or YAML document.'
        ),
        draft: null,
      };
    }

    // 2. Syntax Parsing (JSON or YAML)
    let parsedObj: any = null;
    let parseError: string | null = null;

    if (rawText.startsWith('{') || rawText.startsWith('[')) {
      try {
        parsedObj = JSON.parse(rawText);
        sourceFormat = 'json';
      } catch (err: any) {
        parseError = `JSON syntax error: ${err.message}`;
      }
    }

    if (!parsedObj) {
      try {
        parsedObj = YAML.parse(rawText);
        sourceFormat = 'yaml';
        parseError = null;
      } catch (err: any) {
        if (!parseError) {
          parseError = `YAML syntax error: ${err.message}`;
        }
      }
    }

    if (!parsedObj || typeof parsedObj !== 'object') {
      return {
        report: this.createFailureReport(
          'ERR_SYNTAX_INVALID',
          parseError || 'Could not parse content as valid JSON or YAML.',
          undefined,
          'Check for syntax errors, unclosed brackets, or invalid indentation in your YAML/JSON.'
        ),
        draft: null,
      };
    }

    // 3. Check for APIMatic Cloud Validation
    let apimaticCloudResult: any = null;
    let apimaticNotice: string | undefined;

    if (env.APIMATIC_API_KEY && env.APIMATIC_API_KEY.trim() !== '' && env.APIMATIC_API_KEY !== 'mock') {
      try {
        const cloudValidation = await this.callApimaticCloudValidate(rawText, sourceFormat);
        if (cloudValidation.success) {
          apimaticCloudResult = cloudValidation.data;
        } else {
          apimaticNotice = `APIMatic Cloud API notice: ${cloudValidation.message}. ToolToll OpenAPI Validation Engine used.`;
        }
      } catch (err: any) {
        apimaticNotice = `APIMatic Cloud API error: ${err.message}. ToolToll OpenAPI Validation Engine used.`;
      }
    } else {
      apimaticNotice = 'APIMatic Cloud API key not configured; executed full structural and schema analysis via ToolToll OpenAPI Engine.';
    }

    // 4. Run Comprehensive OpenAPI / Swagger Deep Validation
    const report = this.runStructuralValidation(parsedObj, apimaticCloudResult, apimaticNotice);

    // 5. Build ToolToll Draft if Valid or Only Warnings
    let draft: ToolTollDraftConfig | null = null;
    if (report.isValid) {
      draft = this.buildToolTollDraft(parsedObj, report.endpointDetails, sourceFormat);
    }

    return { report, draft };
  }

  /**
   * Run structural inspection on OpenAPI / Swagger objects
   */
  private static runStructuralValidation(
    spec: any,
    cloudResult: any,
    apimaticNotice?: string
  ): ApimaticValidationReport {
    const errors: ApimaticValidationIssue[] = [];
    const warnings: ApimaticValidationIssue[] = [];
    const successfulChecks: Array<{ check: string; description: string }> = [];
    const schemaIssues: Array<{ schemaName: string; issue: string; severity: 'error' | 'warning' }> = [];
    const endpointDetails: ApimaticEndpointSummary[] = [];

    // Root Version Check
    const isOpenApi3 = typeof spec.openapi === 'string' && spec.openapi.startsWith('3.');
    const isSwagger2 = spec.swagger === '2.0';
    const specVersion = spec.openapi || spec.swagger || 'Unknown';

    if (!isOpenApi3 && !isSwagger2) {
      errors.push({
        code: 'ERR_SPEC_VERSION_UNSUPPORTED',
        message: `Missing or unsupported specification version: "${specVersion}".`,
        path: spec.openapi ? 'openapi' : 'swagger',
        severity: 'error',
        suggestion: "Specify a valid version like 'openapi: 3.0.0' or 'swagger: \"2.0\"' at the root.",
      });
    } else {
      successfulChecks.push({
        check: 'Specification Standard',
        description: `Verified ${isOpenApi3 ? 'OpenAPI ' + spec.openapi : 'Swagger 2.0'} standard.`,
      });
    }

    // Info Object Check
    const info = spec.info;
    const specTitle = info?.title || 'Untitled API';
    if (!info || typeof info !== 'object') {
      errors.push({
        code: 'ERR_MISSING_INFO',
        message: "Specification is missing the required 'info' object.",
        path: 'info',
        severity: 'error',
        suggestion: "Add an 'info' block with 'title', 'version', and 'description'.",
      });
    } else {
      if (!info.title || typeof info.title !== 'string') {
        errors.push({
          code: 'ERR_MISSING_TITLE',
          message: "The 'info.title' field is required but missing or empty.",
          path: 'info.title',
          severity: 'error',
          suggestion: 'Provide a clear, human-readable name for your API service.',
        });
      } else {
        successfulChecks.push({
          check: 'API Metadata',
          description: `API Title "${info.title}" and version "${info.version || '1.0.0'}" verified.`,
        });
      }

      if (!info.description || info.description.trim().length === 0) {
        warnings.push({
          code: 'WARN_MISSING_DESCRIPTION',
          message: "API description is missing under 'info.description'.",
          path: 'info.description',
          severity: 'warning',
          suggestion: 'Adding a comprehensive description helps AI agents accurately match user requests to this tool.',
        });
      }
    }

    // Server / Base URL Check
    let detectedBaseUrl = '';
    if (isOpenApi3) {
      if (Array.isArray(spec.servers) && spec.servers.length > 0 && spec.servers[0].url) {
        detectedBaseUrl = spec.servers[0].url;
        successfulChecks.push({
          check: 'Target Server Host',
          description: `Primary server base URL identified: "${detectedBaseUrl}".`,
        });
        if (detectedBaseUrl.startsWith('http://') && !detectedBaseUrl.includes('localhost') && !detectedBaseUrl.includes('127.0.0.1')) {
          warnings.push({
            code: 'WARN_INSECURE_PROTOCOL',
            message: `Server URL "${detectedBaseUrl}" uses unencrypted HTTP.`,
            path: 'servers[0].url',
            severity: 'warning',
            suggestion: 'Production APIs should use HTTPS to protect client credentials and data in transit.',
          });
        }
      } else {
        warnings.push({
          code: 'WARN_MISSING_SERVERS',
          message: "No server URLs defined under 'servers'. Defaulting to host.",
          path: 'servers',
          severity: 'warning',
          suggestion: "Add a 'servers' array with at least one server entry containing a 'url'.",
        });
      }
    } else if (isSwagger2) {
      const host = spec.host || 'api.example.com';
      const scheme = (Array.isArray(spec.schemes) && spec.schemes[0]) || 'https';
      const basePath = spec.basePath || '';
      detectedBaseUrl = `${scheme}://${host}${basePath}`;
      successfulChecks.push({
        check: 'Target Server Host',
        description: `Swagger 2.0 host and basePath mapped to "${detectedBaseUrl}".`,
      });
    }

    // Global Security Schemes Check
    let defaultAuthType: 'NONE' | 'API_KEY_HEADER' | 'BEARER_TOKEN' | 'BASIC_AUTH' = 'NONE';
    let defaultAuthHeader: string | undefined = undefined;

    const securitySchemes = isOpenApi3
      ? spec.components?.securitySchemes
      : spec.securityDefinitions;

    if (securitySchemes && typeof securitySchemes === 'object') {
      const schemeKeys = Object.keys(securitySchemes);
      if (schemeKeys.length > 0) {
        const firstKey = schemeKeys[0];
        const s = securitySchemes[firstKey];
        if (s.type === 'apiKey' && (s.in === 'header' || !s.in)) {
          defaultAuthType = 'API_KEY_HEADER';
          defaultAuthHeader = s.name || 'X-API-Key';
        } else if (s.type === 'http' && (s.scheme === 'bearer' || s.scheme === 'Bearer')) {
          defaultAuthType = 'BEARER_TOKEN';
        } else if (s.type === 'http' && s.scheme === 'basic') {
          defaultAuthType = 'BASIC_AUTH';
        } else if (s.type === 'basic') {
          defaultAuthType = 'BASIC_AUTH';
        } else if (s.type === 'oauth2') {
          defaultAuthType = 'BEARER_TOKEN';
        }

        successfulChecks.push({
          check: 'Security Definitions',
          description: `Discovered authentication scheme "${firstKey}" (${s.type || 'http'}).`,
        });
      }
    }

    // Paths and Endpoints Inspection
    const paths = spec.paths;
    if (!paths || typeof paths !== 'object' || Object.keys(paths).length === 0) {
      errors.push({
        code: 'ERR_NO_ENDPOINTS',
        message: "Specification does not contain any API routes under 'paths'.",
        path: 'paths',
        severity: 'error',
        suggestion: "Add at least one path (e.g. '/v1/resource') with supported HTTP methods.",
      });
    } else {
      const allowedMethods = ['get', 'post', 'put', 'patch', 'delete'];
      let endpointIndex = 0;

      for (const [routePath, pathItem] of Object.entries(paths)) {
        if (!routePath.startsWith('/')) {
          warnings.push({
            code: 'WARN_INVALID_PATH_FORMAT',
            message: `Route path "${routePath}" does not start with a leading slash '/'.`,
            path: `paths.${routePath}`,
            severity: 'warning',
            suggestion: `Change "${routePath}" to "/${routePath}".`,
          });
        }

        if (!pathItem || typeof pathItem !== 'object') continue;

        for (const [method, opAny] of Object.entries(pathItem as Record<string, any>)) {
          const lowerMethod = method.toLowerCase();
          if (!allowedMethods.includes(lowerMethod)) continue;

          const op = opAny || {};
          const opSummary = op.summary || op.operationId || `${method.toUpperCase()} ${routePath}`;
          const opDescription = op.description || op.summary || `Endpoint for ${routePath}`;

          // Request Body / Input Schema extraction
          let inputSchema: Record<string, unknown> = {
            type: 'object',
            properties: {},
          };
          let hasInputSchema = false;
          let exampleRequest: Record<string, unknown> | undefined = undefined;

          // OpenAPI 3 requestBody
          if (op.requestBody?.content) {
            const jsonContent = op.requestBody.content['application/json'];
            if (jsonContent?.schema) {
              inputSchema = jsonContent.schema;
              hasInputSchema = true;
              if (jsonContent.example) {
                exampleRequest = jsonContent.example;
              } else if (jsonContent.examples) {
                const firstEx = Object.values(jsonContent.examples)[0] as any;
                exampleRequest = firstEx?.value || firstEx;
              }
            }
          }

          // Parameters inspection (query, header, path, formData, body)
          const paramsList: any[] = [
            ...(Array.isArray((pathItem as any).parameters) ? (pathItem as any).parameters : []),
            ...(Array.isArray(op.parameters) ? op.parameters : []),
          ];

          if (paramsList.length > 0) {
            const props: Record<string, any> = (inputSchema.properties as Record<string, any>) || {};
            const requiredFields: string[] = Array.isArray(inputSchema.required) ? [...inputSchema.required] : [];

            for (const param of paramsList) {
              if (param.name) {
                props[param.name] = param.schema || {
                  type: param.type || 'string',
                  description: param.description,
                };
                if (param.required && !requiredFields.includes(param.name)) {
                  requiredFields.push(param.name);
                }
              }
              if (param.in === 'body' && param.schema) {
                inputSchema = param.schema;
                hasInputSchema = true;
              }
            }

            inputSchema.properties = props;
            if (requiredFields.length > 0) {
              inputSchema.required = requiredFields;
            }
            hasInputSchema = true;
          }

          // Output Schema extraction
          let outputSchema: Record<string, unknown> | undefined = undefined;
          let exampleResponse: Record<string, unknown> | undefined = undefined;
          let hasOutputSchema = false;

          const responses = op.responses || {};
          const successRes = responses['200'] || responses['201'] || responses['202'] || responses['default'];

          if (successRes) {
            if (successRes.content && successRes.content['application/json']?.schema) {
              outputSchema = successRes.content['application/json'].schema;
              hasOutputSchema = true;
              exampleResponse = successRes.content['application/json'].example;
            } else if (successRes.schema) {
              outputSchema = successRes.schema;
              hasOutputSchema = true;
              exampleResponse = successRes.examples?.['application/json'];
            }
          } else {
            warnings.push({
              code: 'WARN_NO_SUCCESS_RESPONSE',
              message: `Endpoint ${method.toUpperCase()} ${routePath} has no 200/201 success response defined.`,
              path: `paths.${routePath}.${method}.responses`,
              severity: 'warning',
              suggestion: "Add a '200' response definition with expected response JSON Schema.",
            });
          }

          // Validate Schema Integrity
          if (hasInputSchema && typeof inputSchema === 'object') {
            if (!inputSchema.type && !inputSchema.$ref && !inputSchema.properties) {
              schemaIssues.push({
                schemaName: `${opSummary} (Input Schema)`,
                issue: "Input schema is missing explicit 'type: object' declaration.",
                severity: 'warning',
              });
            }
          }

          // Security check per endpoint
          let endpointAuthType = defaultAuthType;
          let endpointAuthHeader = defaultAuthHeader;
          let authRequired = defaultAuthType !== 'NONE';

          if (Array.isArray(op.security)) {
            if (op.security.length === 0) {
              endpointAuthType = 'NONE';
              authRequired = false;
            }
          }

          endpointDetails.push({
            path: routePath,
            method: method.toUpperCase(),
            name: opSummary,
            description: opDescription,
            inputSchema,
            outputSchema,
            exampleRequest,
            exampleResponse,
            authRequired,
            authType: endpointAuthType,
            authHeaderName: endpointAuthHeader,
            parametersCount: paramsList.length,
            hasInputSchema,
            hasOutputSchema,
            priceMicroUsd: '1000', // default 1000 micro-USD ($0.001)
            timeoutMs: 15000,
            isPrimary: endpointIndex === 0,
          });

          endpointIndex++;
        }
      }

      if (endpointDetails.length > 0) {
        successfulChecks.push({
          check: 'Endpoints & Operations',
          description: `Discovered and inspected ${endpointDetails.length} functional API endpoint(s).`,
        });
      }
    }

    // Merge Cloud APIMatic results if available
    if (cloudResult && Array.isArray(cloudResult.errors)) {
      for (const err of cloudResult.errors) {
        errors.push({
          code: 'APIMATIC_ERR',
          message: err.message || String(err),
          path: err.path,
          severity: 'error',
          suggestion: err.suggestion || 'Review specification against OpenAPI standards.',
        });
      }
    }
    if (cloudResult && Array.isArray(cloudResult.warnings)) {
      for (const warn of cloudResult.warnings) {
        warnings.push({
          code: 'APIMATIC_WARN',
          message: warn.message || String(warn),
          path: warn.path,
          severity: 'warning',
          suggestion: warn.suggestion,
        });
      }
    }

    const isValid = errors.length === 0 && endpointDetails.length > 0;
    const status: 'VALID' | 'WARNINGS' | 'INVALID' = !isValid
      ? 'INVALID'
      : warnings.length > 0
      ? 'WARNINGS'
      : 'VALID';

    return {
      engine: cloudResult ? 'apimatic_cloud' : 'apimatic_local_engine',
      engineDetails: cloudResult
        ? 'Validated through APIMatic Platform Cloud API'
        : 'Validated via ToolToll APIMatic OpenAPI Engine',
      isValid,
      status,
      specTitle,
      specVersion,
      summary: {
        totalIssues: errors.length + warnings.length,
        errorsCount: errors.length,
        warningsCount: warnings.length,
        successfulChecksCount: successfulChecks.length,
        endpointsCount: endpointDetails.length,
      },
      errors,
      warnings,
      successfulChecks,
      endpointDetails,
      schemaIssues,
      apimaticNotice,
    };
  }

  /**
   * Convert validated spec into ToolToll Tool & ToolEndpoint draft structure
   */
  private static buildToolTollDraft(
    spec: any,
    endpoints: ApimaticEndpointSummary[],
    rawSpecFormat: 'json' | 'yaml'
  ): ToolTollDraftConfig {
    const info = spec.info || {};
    const title = info.title || 'Imported API Service';
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
    const fullDesc = info.description || `Onboarded API service for ${title}`;
    const shortDesc = fullDesc.length > 180 ? `${fullDesc.slice(0, 177)}...` : fullDesc;

    // Determine category
    const tags: string[] = [];
    if (Array.isArray(spec.tags)) {
      for (const t of spec.tags) {
        if (t.name) tags.push(String(t.name).toLowerCase());
      }
    }
    for (const ep of endpoints) {
      const parts = ep.path.split('/').filter(Boolean);
      if (parts[0] && !tags.includes(parts[0])) tags.push(parts[0]);
    }
    const category = tags.includes('ai')
      ? 'AI / Machine Learning'
      : tags.includes('data')
      ? 'Data & Analytics'
      : tags.includes('security')
      ? 'Security'
      : tags.includes('finance')
      ? 'Finance'
      : 'Utility';

    // Determine server base URL
    let baseUrl = 'https://api.yourdomain.com';
    if (Array.isArray(spec.servers) && spec.servers.length > 0 && spec.servers[0].url) {
      baseUrl = spec.servers[0].url;
    } else if (spec.host) {
      const scheme = (Array.isArray(spec.schemes) && spec.schemes[0]) || 'https';
      const bp = spec.basePath || '';
      baseUrl = `${scheme}://${spec.host}${bp}`;
    }

    // Clean up trailing slash on baseUrl
    baseUrl = baseUrl.replace(/\/+$/, '');

    const primaryEndpoint = endpoints[0] || {
      path: '/v1/run',
      method: 'POST',
      name: `${title} (Primary)`,
      description: shortDesc,
      inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
      authType: 'NONE',
      priceMicroUsd: '1000',
      timeoutMs: 15000,
      isPrimary: true,
    };

    return {
      name: title,
      slug,
      shortDescription: shortDesc,
      detailedDescription: fullDesc,
      category,
      tags: tags.length > 0 ? tags.slice(0, 5) : [category.toLowerCase(), 'api'],
      baseUrl,
      endpointPath: primaryEndpoint.path,
      httpMethod: primaryEndpoint.method,
      authMethod: primaryEndpoint.authType,
      authHeaderName: primaryEndpoint.authHeaderName,
      priceMicroUsd: primaryEndpoint.priceMicroUsd || '1000',
      timeoutMs: 15000,
      endpoints,
      rawSpecFormat,
      specVersion: spec.openapi || spec.swagger || '3.0.0',
    };
  }

  /**
   * Helper to create a failure report for syntax/fetch/version errors
   */
  private static createFailureReport(
    code: string,
    message: string,
    path?: string,
    suggestion?: string
  ): ApimaticValidationReport {
    return {
      engine: 'apimatic_local_engine',
      engineDetails: 'ToolToll APIMatic Validation Engine',
      isValid: false,
      status: 'INVALID',
      specTitle: 'Unknown API',
      specVersion: 'Invalid',
      summary: {
        totalIssues: 1,
        errorsCount: 1,
        warningsCount: 0,
        successfulChecksCount: 0,
        endpointsCount: 0,
      },
      errors: [
        {
          code,
          message,
          path,
          severity: 'error',
          suggestion,
        },
      ],
      warnings: [],
      successfulChecks: [],
      endpointDetails: [],
      schemaIssues: [],
      apimaticNotice: 'Validation aborted due to fatal syntax or accessibility error.',
    };
  }

  /**
   * Call live APIMatic Cloud validation API
   */
  private static async callApimaticCloudValidate(
    rawSpec: string,
    format: 'json' | 'yaml'
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    const url = `${env.APIMATIC_BASE_URL.replace(/\/+$/, '')}/api-entities/validate`;
    const res = await request(url, {
      method: 'POST',
      headers: {
        'Authorization': `X-Auth-Key ${env.APIMATIC_API_KEY}`,
        'Content-Type': format === 'json' ? 'application/json' : 'application/x-yaml',
        'User-Agent': 'ToolToll-Marketplace/1.0',
      },
      body: rawSpec,
      bodyTimeout: 15000,
      headersTimeout: 15000,
    });

    if (res.statusCode >= 200 && res.statusCode < 300) {
      const data = await res.body.json();
      return { success: true, data };
    }

    return {
      success: false,
      message: `Status ${res.statusCode} ${res.headers['content-type'] || ''}`,
    };
  }

  /**
   * Multi-language Client SDK Generator (TypeScript & Python)
   * Produces fully typed client code tailored to the registered ToolToll tool.
   */
  static generateClientSdk(
    tool: {
      name: string;
      slug: string;
      baseUrl: string;
      endpoints?: any[];
      category?: string;
      priceMicroUsd?: any;
    },
    language: 'typescript' | 'python'
  ): { language: string; filename: string; code: string } {
    const endpoints = (tool.endpoints && tool.endpoints.length > 0)
      ? tool.endpoints
      : [
          {
            name: `${tool.name} Primary`,
            endpointPath: '/v1/run',
            httpMethod: 'POST',
            inputSchema: { type: 'object' },
            outputSchema: { type: 'object' },
          },
        ];

    if (language === 'typescript') {
      const safeClassName = tool.name.replace(/[^a-zA-Z0-9]/g, '') + 'Client';

      const methodDeclarations = endpoints.map((ep, idx) => {
        const methodName = (ep.name || `callEndpoint${idx + 1}`)
          .toLowerCase()
          .replace(/[^a-zA-Z0-9]+(.)/g, (_: any, chr: string) => chr.toUpperCase())
          .replace(/[^a-zA-Z0-9]/g, '');

        return `  /**
   * ${ep.name || ep.endpointPath}
   * Method: ${ep.httpMethod} ${ep.endpointPath}
   */
  async ${methodName || 'execute'}(input: Record<string, unknown> = {}): Promise<any> {
    return this.request('${ep.endpointPath}', '${ep.httpMethod}', input, '${ep.id || ''}');
  }`;
      }).join('\n\n');

      const code = `/**
 * ToolToll Client SDK for ${tool.name}
 * Generated via APIMatic Integration Engine
 *
 * Usage:
 *   import { ${safeClassName} } from './${tool.slug}-sdk';
 *   const client = new ${safeClassName}('tt_live_your_agent_key_here');
 *   const result = await client.${endpoints[0]?.name ? endpoints[0].name.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_: any, c: string) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '') : 'execute'}({ ... });
 */

export class ${safeClassName} {
  private gatewayUrl: string;
  private apiKey: string;

  constructor(apiKey: string, gatewayUrl = 'http://localhost:4000') {
    if (!apiKey) {
      throw new Error('ToolToll Agent Key (tt_live_...) is required to initialize client.');
    }
    this.apiKey = apiKey;
    this.gatewayUrl = gatewayUrl.replace(/\\/+$/, '');
  }

  private async request(endpointPath: string, method: string, payload: Record<string, unknown>, endpointId?: string): Promise<any> {
    const url = \`\${this.gatewayUrl}/api/tools/${tool.slug}/calls\`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${this.apiKey}\`,
        'X-Agent-Key': this.apiKey,
        'Idempotency-Key': 'tt_sdk_' + Math.random().toString(36).substring(2) + Date.now().toString(36),
      },
      body: JSON.stringify({
        input: payload,
        endpointId: endpointId || undefined,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(\`ToolToll execution failed (HTTP \${res.status}): \${errBody.error?.message || res.statusText}\`);
    }

    const json = await res.json();
    return json.data?.result;
  }

${methodDeclarations}
}
`;

      return {
        language: 'typescript',
        filename: `${tool.slug}-sdk.ts`,
        code,
      };
    } else {
      // Python SDK
      const safeClassName = tool.name.replace(/[^a-zA-Z0-9]/g, '') + 'Client';

      const methodDeclarations = endpoints.map((ep, idx) => {
        const methodName = (ep.name || `endpoint_${idx + 1}`)
          .toLowerCase()
          .replace(/[^a-zA-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');

        return `    def ${methodName || 'execute'}(self, payload: dict = None) -> dict:
        """
        ${ep.name || ep.endpointPath}
        Method: ${ep.httpMethod} ${ep.endpointPath}
        """
        return self._request(
            endpoint_path="${ep.endpointPath}",
            method="${ep.httpMethod}",
            payload=payload or {},
            endpoint_id="${ep.id || ''}",
        )`;
      }).join('\n\n');

      const code = `"""
ToolToll Client SDK for ${tool.name}
Generated via APIMatic Integration Engine

Usage:
    from ${tool.slug.replace(/-/g, '_')}_sdk import ${safeClassName}

    client = ${safeClassName}(api_key="tt_live_your_agent_key_here")
    result = client.${endpoints[0]?.name ? endpoints[0].name.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') : 'execute'}({...})
"""

import json
import time
import uuid
import urllib.request
import urllib.error


class ${safeClassName}:
    def __init__(self, api_key: str, gateway_url: str = "http://localhost:4000"):
        if not api_key:
            raise ValueError("ToolToll Agent Key (tt_live_...) is required to initialize client.")
        self.api_key = api_key
        self.gateway_url = gateway_url.rstrip("/")

    def _request(self, endpoint_path: str, method: str, payload: dict, endpoint_id: str = "") -> dict:
        url = f"{self.gateway_url}/api/tools/${tool.slug}/calls"
        idempotency_key = f"tt_sdk_{uuid.uuid4().hex[:12]}_{int(time.time())}"

        body_data = {
            "input": payload,
        }
        if endpoint_id:
            body_data["endpointId"] = endpoint_id

        req = urllib.request.Request(
            url=url,
            data=json.dumps(body_data).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
                "X-Agent-Key": self.api_key,
                "Idempotency-Key": idempotency_key,
                "User-Agent": "ToolToll-Python-SDK/1.0",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                return res_data.get("data", {}).get("result", {})
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8")
            raise RuntimeError(f"ToolToll execution error ({e.code}): {err_msg}")

${methodDeclarations}
`;

      return {
        language: 'python',
        filename: `${tool.slug.replace(/-/g, '_')}_sdk.py`,
        code,
      };
    }
  }
}
