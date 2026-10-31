import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dollarsToMicroUsd, microUsdToDollars, calculatePlatformFee } from '../src/utils/money';
import { encryptSecret, decryptSecret, generateAgentToken, hashAgentToken } from '../src/lib/crypto';
import { isPrivateOrRestrictedIp, validateOutboundUrl } from '../src/lib/ssrf';
import { SSRFBlockedError } from '../src/utils/errors';

describe('ToolToll Non-Negotiable Invariants', () => {
  // Invariant 3: Micro-USD BigInt (no floats in money paths)
  describe('Invariant 3: Micro-USD Money Precision (BigInt)', () => {
    it('should correctly convert dollar strings to micro-USD BigInt without precision loss', () => {
      assert.equal(dollarsToMicroUsd('1.00'), 1_000_000n);
      assert.equal(dollarsToMicroUsd('0.001'), 1_000n);
      assert.equal(dollarsToMicroUsd('0.000001'), 1n);
      assert.equal(dollarsToMicroUsd('10.50'), 10_500_000n);
      assert.equal(dollarsToMicroUsd('0.0025'), 2_500n);
    });

    it('should correctly convert micro-USD BigInt to dollars display string', () => {
      assert.equal(microUsdToDollars(1_000_000n), '1.000000');
      assert.equal(microUsdToDollars(2_500n), '0.002500');
      assert.equal(microUsdToDollars(10_500_000n), '10.500000');
    });

    it('should calculate platform fees accurately with integer basis points (no floats)', () => {
      const gross = 10_000n; // $0.010
      const bps = 1000; // 10% (1000 bps)
      const { platformFeeMicroUsd, creatorEarningsMicroUsd } = calculatePlatformFee(gross, bps);

      assert.equal(platformFeeMicroUsd, 1_000n);
      assert.equal(creatorEarningsMicroUsd, 9_000n);
      assert.equal(platformFeeMicroUsd + creatorEarningsMicroUsd, gross);
    });
  });

  // Invariant 8: Upstream secrets encrypted at rest (AES-256-GCM)
  describe('Invariant 8: AES-256-GCM Secret Encryption at Rest', () => {
    it('should encrypt and decrypt secrets properly using AES-256-GCM with versioned keys', () => {
      const plaintext = 'sk_live_very_secret_api_key_12345';
      const { encrypted, keyVersion } = encryptSecret(plaintext);

      assert.equal(keyVersion, 'v1');
      assert.ok(!encrypted.includes(plaintext));

      const parts = encrypted.split(':');
      assert.equal(parts.length, 3);

      const decrypted = decryptSecret(encrypted);
      assert.equal(decrypted, plaintext);
    });

    it('should fail decryption if ciphertext or authentication tag is tampered with', () => {
      const plaintext = 'secret_key';
      const { encrypted } = encryptSecret(plaintext);
      const [iv, ct, tag] = encrypted.split(':');
      
      const tamperedCt = ct.endsWith('00')
        ? ct.substring(0, ct.length - 2) + 'ff'
        : ct.substring(0, ct.length - 2) + '00';
      const tamperedPayload = `${iv}:${tamperedCt}:${tag}`;

      assert.throws(() => decryptSecret(tamperedPayload), Error);
    });
  });

  // Invariant 2: High-entropy agent credentials (>=256 bits entropy)
  describe('Invariant 2: High-Entropy Agent Credentials', () => {
    it('should generate at least 256 bits of entropy with prefix and consistent hash', () => {
      const { token, prefix, tokenHash } = generateAgentToken();

      assert.match(token, /^tt_live_[a-f0-9]{64}$/);
      assert.match(prefix, /^tt_live_[a-f0-9]{8}$/);
      assert.ok(token.startsWith(prefix));
      assert.equal(tokenHash, hashAgentToken(token));
    });

    it('should produce distinct tokens on subsequent invocations', () => {
      const cred1 = generateAgentToken();
      const cred2 = generateAgentToken();

      assert.notEqual(cred1.token, cred2.token);
      assert.notEqual(cred1.tokenHash, cred2.tokenHash);
    });
  });

  // Invariant 9: Strict SSRF protection
  describe('Invariant 9: Strict SSRF Protection', () => {
    it('should block IPv4 loopback (127.0.0.0/8)', () => {
      assert.equal(isPrivateOrRestrictedIp('127.0.0.1'), true);
      assert.equal(isPrivateOrRestrictedIp('127.0.1.1'), true);
    });

    it('should block IPv4 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)', () => {
      assert.equal(isPrivateOrRestrictedIp('10.0.0.1'), true);
      assert.equal(isPrivateOrRestrictedIp('172.16.0.1'), true);
      assert.equal(isPrivateOrRestrictedIp('172.31.255.255'), true);
      assert.equal(isPrivateOrRestrictedIp('192.168.1.1'), true);
    });

    it('should block cloud metadata IP (169.254.169.254)', () => {
      assert.equal(isPrivateOrRestrictedIp('169.254.169.254'), true);
    });

    it('should block IPv6 loopback and unique local addresses (::1, fc00::/7)', () => {
      assert.equal(isPrivateOrRestrictedIp('::1'), true);
      assert.equal(isPrivateOrRestrictedIp('fc00::1'), true);
      assert.equal(isPrivateOrRestrictedIp('fd12:3456:789a::1'), true);
    });

    it('should allow valid public IP addresses', () => {
      assert.equal(isPrivateOrRestrictedIp('8.8.8.8'), false);
      assert.equal(isPrivateOrRestrictedIp('1.1.1.1'), false);
      assert.equal(isPrivateOrRestrictedIp('142.250.190.46'), false);
    });

    it('should throw SSRFBlockedError for cloud metadata hostnames', async () => {
      await assert.rejects(
        () => validateOutboundUrl('http://169.254.169.254/latest/meta-data'),
        SSRFBlockedError
      );
      await assert.rejects(
        () => validateOutboundUrl('http://metadata.google.internal/computeMetadata'),
        SSRFBlockedError
      );
    });

    it('should reject non-HTTP(S) protocols', async () => {
      await assert.rejects(() => validateOutboundUrl('ftp://example.com/file'), SSRFBlockedError);
      await assert.rejects(() => validateOutboundUrl('file:///etc/passwd'), SSRFBlockedError);
      await assert.rejects(() => validateOutboundUrl('gopher://example.com'), SSRFBlockedError);
    });
  });
});
