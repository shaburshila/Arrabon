'use strict';

/**
 * Pre-require setup for service-layer unit tests.
 *
 * Loaded via `--require` before tsconfig-paths and ts-node, so the mocked
 * module entries are present in require.cache when the service module is
 * first compiled and required by the test runner.
 *
 * Modules mocked:
 *   - server-only                          (throws outside Next.js runtime)
 *   - @/lib/crypto/meeting-url             (reads env var at module load time)
 *   - @/lib/crypto/link-hash
 *   - @/lib/compliance/error-mapping
 *   - @/server/repositories/consultation-links
 *   - @/server/repositories/deals
 *   - @/server/services/compliance
 *
 * The error classes and the mutable `getById` / `getByConsultationLinkId`
 * delegates are exposed on `global.__serviceMocks` so individual tests can
 * swap them out in a beforeEach hook.
 */

const path = require('path');

// ── helpers ─────────────────────────────────────────────────────────────────

function makeEntry(id, exports) {
  return {
    id,
    filename: id,
    loaded: true,
    exports,
    paths: [],
    parent: null,
    children: [],
  };
}

// ── server-only stub ─────────────────────────────────────────────────────────

require.cache[require.resolve('server-only')] = makeEntry('server-only', {});

// ── shared error classes ─────────────────────────────────────────────────────
// These MUST be the same class references that the service module imports so
// that instanceof checks work correctly.

class ConsultationLinksRepositoryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ConsultationLinksRepositoryError';
    this.code = code;
  }
}

class DealsRepositoryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'DealsRepositoryError';
    this.code = code;
  }
}

// ── mutable mock state ───────────────────────────────────────────────────────
// Tests reset these in beforeEach. The module exports delegate through this
// object so swapping the function also updates what the service sees.

const mocks = {
  assertCompliance: (...args) => undefined,
  createLink: async () => ({ id: 'link-uuid-created', link_hash: '0x' + 'c'.repeat(64) }),
  getAllByCreatorUserId: async () => [],
  getById: async () => null,
  getByCreatorUserId: async () => [],
  getByConsultationLinkId: async () => null,
  getByConsultationLinkIds: async () => [],
  screenWalletForDeal: async () => ({
    normalizedWallet: '0xexpertaddress',
    provider: null,
    rawSummary: { providerResults: [] },
    reasonCode: 'NO_HIT',
    result: 'Clear',
    walletAddress: '0x00000000000000000000000000000000000000AA',
  }),
  screenWalletsBatch: async () => [],
  ConsultationLinksRepositoryError,
  DealsRepositoryError,
};

global.__serviceMocks = mocks;

// ── inject mock modules ──────────────────────────────────────────────────────

const root = path.resolve(__dirname, '../../');

// @/lib/crypto/meeting-url — calls loadMeetingUrlEncryptionKey() at load time
// which throws when MEETING_URL_ENCRYPTION_KEY is not set.
const meetingUrlPath = path.resolve(root, 'lib/crypto/meeting-url.ts');
require.cache[meetingUrlPath] = makeEntry(meetingUrlPath, {
  encryptMeetingUrl: () => 'mock-encrypted',
  decryptMeetingUrl: () => 'mock-decrypted',
});

const linkHashPath = path.resolve(root, 'lib/crypto/link-hash.ts');
require.cache[linkHashPath] = makeEntry(linkHashPath, {
  assertLinkHash: (value) => value,
  generateLinkHash: () => '0x' + '1'.repeat(64),
});

const complianceErrorMappingPath = path.resolve(root, 'lib/compliance/error-mapping.ts');
require.cache[complianceErrorMappingPath] = makeEntry(complianceErrorMappingPath, {
  ComplianceBlockedError: class ComplianceBlockedError extends Error {
    constructor(input) {
      super('Compliance blocked');
      this.name = 'ComplianceBlockedError';
      this.dealId = input.dealId;
      this.provider = input.provider;
      this.reasonCode = input.reasonCode;
      this.walletAddress = input.walletAddress;
    }
  },
  assertCompliance: (...args) => mocks.assertCompliance(...args),
  complianceErrorToHttpResponse: () => { throw new Error('not mocked in service tests'); },
  withComplianceErrorHandling: (handler) => handler,
});

const complianceServicePath = path.resolve(root, 'server/services/compliance.ts');
require.cache[complianceServicePath] = makeEntry(complianceServicePath, {
  screenWalletForDeal: (...args) => mocks.screenWalletForDeal(...args),
  screenWalletsBatch: (...args) => mocks.screenWalletsBatch(...args),
});

// @/server/repositories/consultation-links
const consultationLinksRepoPath = path.resolve(
  root,
  'server/repositories/consultation-links.ts',
);
require.cache[consultationLinksRepoPath] = makeEntry(consultationLinksRepoPath, {
  ConsultationLinksRepositoryError,
  getAllByCreatorUserId: (...args) => mocks.getAllByCreatorUserId(...args),
  getById: (...args) => mocks.getById(...args),
  getByCreatorUserId: (...args) => mocks.getByCreatorUserId(...args),
  createLink: (...args) => mocks.createLink(...args),
  updateStatus: async () => { throw new Error('updateStatus: not mocked in service tests'); },
  getByLinkHash: async () => { throw new Error('getByLinkHash: not mocked in service tests'); },
});

// @/server/repositories/deals
const dealsRepoPath = path.resolve(root, 'server/repositories/deals.ts');
require.cache[dealsRepoPath] = makeEntry(dealsRepoPath, {
  DealsRepositoryError,
  getByConsultationLinkId: (...args) => mocks.getByConsultationLinkId(...args),
  getByConsultationLinkIds: (...args) => mocks.getByConsultationLinkIds(...args),
});
