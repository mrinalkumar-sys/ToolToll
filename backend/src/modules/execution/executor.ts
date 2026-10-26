import { request } from 'undici';
import { validateOutboundUrl } from '../../lib/ssrf';
import { decryptSecret } from '../../lib/crypto';
import { env } from '../../config/env';

export interface ExecutionParams {
  baseUrl: string;
  endpointPath: string;
  httpMethod: string;
  authMethod: string;
  authHeaderName?: string | null;
  encryptedSecret?: string | null;
  payload: unknown;
  timeoutMs: number;
  isDemo?: boolean;
}

export interface ExecutionResult {
  statusCode: number;
  body: unknown;
  latencyMs: number;
  isSuccess: boolean;
  failureReason?: string;
}

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
]);

/**
 * Execute outbound HTTP request to upstream tool securely
 */
export async function executeUpstreamTool(params: ExecutionParams): Promise<ExecutionResult> {
  const fullUrl = new URL(params.endpointPath, params.baseUrl).toString();
  const startTime = Date.now();

  // Step 1: Strict SSRF check and DNS resolution
  const validatedTarget = await validateOutboundUrl(fullUrl, params.isDemo);

  // Step 2: Build headers
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'accept': 'application/json',
    'user-agent': 'ToolToll-Gateway/1.0',
  };

  // Upstream Secret Decryption
  if (params.encryptedSecret) {
    const secret = decryptSecret(params.encryptedSecret);
    if (params.authMethod === 'API_KEY_HEADER') {
      const headerName = (params.authHeaderName || 'X-API-Key').toLowerCase();
      if (!HOP_BY_HOP_HEADERS.has(headerName)) {
        headers[headerName] = secret;
      }
    } else if (params.authMethod === 'BEARER_TOKEN') {
      headers['authorization'] = `Bearer ${secret}`;
    }
  }

  const effectiveTimeout = Math.min(params.timeoutMs || 15000, env.TOOL_EXECUTION_TIMEOUT_MS);
  const serializedBody = params.payload ? JSON.stringify(params.payload) : undefined;

  try {
    const res = await request(validatedTarget.url.toString(), {
      method: params.httpMethod as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
      headers,
      body: serializedBody,
      bodyTimeout: effectiveTimeout,
      headersTimeout: effectiveTimeout,
      maxRedirections: 0, // Invariant 9: Do not auto-follow redirects to prevent SSRF bypass
    });

    const latencyMs = Date.now() - startTime;
    const rawText = await res.body.text();

    // Check size limit
    if (Buffer.byteLength(rawText, 'utf8') > env.MAX_REQUEST_SIZE) {
      return {
        statusCode: res.statusCode,
        body: null,
        latencyMs,
        isSuccess: false,
        failureReason: `Response exceeded max allowed size of ${env.MAX_REQUEST_SIZE} bytes`,
      };
    }

    // Layer A check: Empty response
    if (!rawText.trim() && res.statusCode >= 200 && res.statusCode < 300) {
      return {
        statusCode: res.statusCode,
        body: null,
        latencyMs,
        isSuccess: false,
        failureReason: 'Empty response body from upstream API',
      };
    }

    // Parse JSON
    let parsedBody: unknown = null;
    if (rawText.trim()) {
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        return {
          statusCode: res.statusCode,
          body: rawText.substring(0, 500),
          latencyMs,
          isSuccess: false,
          failureReason: 'Upstream API did not return valid JSON',
        };
      }
    }

    // Check HTTP status code
    if (res.statusCode < 200 || res.statusCode >= 300) {
      return {
        statusCode: res.statusCode,
        body: parsedBody,
        latencyMs,
        isSuccess: false,
        failureReason: `Upstream HTTP error status: ${res.statusCode}`,
      };
    }

    return {
      statusCode: res.statusCode,
      body: parsedBody,
      latencyMs,
      isSuccess: true,
    };
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    const errObj = error as { code?: string; message?: string };
    const failureReason =
      errObj.code === 'UND_ERR_HEADERS_TIMEOUT' || errObj.code === 'UND_ERR_BODY_TIMEOUT'
        ? `Request timed out after ${effectiveTimeout}ms`
        : `Upstream connection error: ${errObj.message || 'Unknown network error'}`;

    return {
      statusCode: 504,
      body: null,
      latencyMs,
      isSuccess: false,
      failureReason,
    };
  }
}
