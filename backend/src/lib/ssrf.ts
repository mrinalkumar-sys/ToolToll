import dns from 'dns';
import net from 'net';
import { URL } from 'url';
import { SSRFBlockedError } from '../utils/errors';
import { env } from '../config/env';

/**
 * Invariant 9: Strict SSRF protection on outbound calls:
 * - Reject loopback, private, link-local, multicast, CGNAT, and cloud metadata ranges
 * - Handle IPv4, IPv6, and IPv4-mapped IPv6
 * - DNS resolution validation and pinning
 * - Restrict ports to 80/443
 */

// Helper to check if IPv4 falls within a CIDR range
function ipInCidr(ip: string, cidrNet: string, maskBits: number): boolean {
  const ipNum = ipToLong(ip);
  const netNum = ipToLong(cidrNet);
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ipNum & mask) === (netNum & mask);
}

function ipToLong(ip: string): number {
  return (
    ip
      .split('.')
      .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
  );
}

export function isPrivateOrRestrictedIp(ip: string, allowLocalhostForDemo: boolean = false): boolean {
  // Normalize IPv4-mapped IPv6 e.g. ::ffff:127.0.0.1
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  // IPv4 Checks
  if (net.isIPv4(ip)) {
    // Loopback 127.0.0.0/8
    if (ipInCidr(ip, '127.0.0.0', 8)) {
      return !allowLocalhostForDemo;
    }
    // "This host on this network" 0.0.0.0/8
    if (ipInCidr(ip, '0.0.0.0', 8)) {
      return true;
    }
    // Private Network 10.0.0.0/8
    if (ipInCidr(ip, '10.0.0.0', 8)) {
      return !allowLocalhostForDemo;
    }
    // Private Network 172.16.0.0/12
    if (ipInCidr(ip, '172.16.0.0', 12)) {
      return !allowLocalhostForDemo;
    }
    // Private Network 192.168.0.0/16
    if (ipInCidr(ip, '192.168.0.0', 16)) {
      return !allowLocalhostForDemo;
    }
    // Link-local / Cloud Metadata 169.254.0.0/16 (e.g. AWS/GCP 169.254.169.254)
    if (ipInCidr(ip, '169.254.0.0', 16)) {
      return true;
    }
    // CGNAT 100.64.0.0/10
    if (ipInCidr(ip, '100.64.0.0', 10)) {
      return true;
    }
    // Multicast 224.0.0.0/4
    if (ipInCidr(ip, '224.0.0.0', 4)) {
      return true;
    }
    // Reserved / Broadcast 240.0.0.0/4
    if (ipInCidr(ip, '240.0.0.0', 4)) {
      return true;
    }

    return false;
  }

  // IPv6 Checks
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    // Loopback ::1
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') {
      return !allowLocalhostForDemo;
    }
    // Unspecified ::
    if (lower === '::' || lower === '0:0:0:0:0:0:0:0') {
      return true;
    }
    // Unique Local Address (ULA) fc00::/7
    if (lower.startsWith('fc') || lower.startsWith('fd')) {
      return !allowLocalhostForDemo;
    }
    // Link-Local fe80::/10
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
      return true;
    }
    // Multicast ff00::/8
    if (lower.startsWith('ff')) {
      return true;
    }

    return false;
  }

  return true; // Reject unrecognized format
}

export interface ValidatedUrlTarget {
  url: URL;
  resolvedIp: string;
  isLocalDemo: boolean;
}

/**
 * Validate outbound destination against SSRF policy and resolve DNS
 */
export async function validateOutboundUrl(targetUrl: string, isDemo: boolean = false): Promise<ValidatedUrlTarget> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    throw new SSRFBlockedError('Invalid URL structure');
  }

  // Restrict protocol to HTTP and HTTPS
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new SSRFBlockedError(`Unsupported protocol: ${parsedUrl.protocol}. Only http and https allowed.`);
  }

  // Restrict ports to 80, 443, or default port for demo tools in dev
  const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : parsedUrl.protocol === 'https:' ? 443 : 80;
  const isDevOrTest = env.APP_ENV === 'development' || env.APP_ENV === 'test';
  const backendPort = parseInt(String(env.PORT), 10);

  const isLocalDemo = (isDemo || isDevOrTest) && (port === backendPort || parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1');

  if (!isLocalDemo && port !== 80 && port !== 443) {
    throw new SSRFBlockedError(`Destination port ${port} is blocked. Only ports 80 and 443 are allowed.`);
  }

  // Block cloud metadata hostnames directly
  const hostname = parsedUrl.hostname.toLowerCase();
  if (
    hostname === 'metadata.google.internal' ||
    hostname === '169.254.169.254' ||
    hostname === 'instance-data'
  ) {
    throw new SSRFBlockedError('Access to cloud metadata endpoints is strictly prohibited');
  }

  // Resolve DNS to verify all addresses
  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(hostname, { all: true });
  } catch (err) {
    throw new SSRFBlockedError(`DNS resolution failed for host: ${hostname}`, { error: String(err) });
  }

  if (!addresses || addresses.length === 0) {
    throw new SSRFBlockedError(`No IP address found for host: ${hostname}`);
  }

  // Verify EVERY resolved IP address
  for (const addr of addresses) {
    if (isPrivateOrRestrictedIp(addr.address, isLocalDemo)) {
      throw new SSRFBlockedError(
        `Destination address resolves to restricted IP: ${addr.address}`,
        { host: hostname, ip: addr.address }
      );
    }
  }

  // Prefer IPv4 for outbound execution stability
  const preferred = addresses.find((a) => a.family === 4) || addresses[0];

  return {
    url: parsedUrl,
    resolvedIp: preferred.address,
    isLocalDemo,
  };
}
