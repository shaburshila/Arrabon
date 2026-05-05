'use strict';

const path = require('path');

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

require.cache[require.resolve('server-only')] = makeEntry('server-only', {});

class DealsRepositoryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'DealsRepositoryError';
    this.code = code;
  }
}

class ConsultEscrowConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConsultEscrowConfigError';
  }
}

const mocks = {
  assertDealNotBlocked: async () => {},
  assertCompliance: () => {},
  createAdminResolutionIntent: async () => ({ id: 'intent-id-1' }),
  createPayoutExecutionGrant: async () => ({
    id: 'grant-id-1',
  }),
  consumePayoutExecutionGrant: async () => ({
    action: 'adminResolveRelease',
    created_at: '2026-05-05T00:00:00.000Z',
    deal_id: 'deal-id-1',
    expires_at: '2026-05-05T00:02:00.000Z',
    id: 'grant-id-1',
    issued_by_wallet: '0x0000000000000000000000000000000000000003',
    issued_to_wallet: '0x0000000000000000000000000000000000000003',
    resolution: 'release',
    token_hash: 'token-hash',
    used_at: '2026-05-05T00:01:00.000Z',
  }),
  findByDealNewestFirst: async () => [],
  getAdminDealReviewRowById: async () => null,
  getDealActionContextById: async () => null,
  listDisputedDealReviewRows: async () => [],
  screenWalletForDeal: async () => ({
    normalizedWallet: '0x0000000000000000000000000000000000000001',
    provider: 'local_denylist',
    rawSummary: {},
    reasonCode: 'NO_HIT',
    result: 'Clear',
    walletAddress: '0x0000000000000000000000000000000000000001',
  }),
  prepareAdminResolveRefundCall: (dealId) => ({
    chain_id: 8453,
    contract_address: '0x0000000000000000000000000000000000000001',
    data: '0x' + String(dealId).padStart(64, '0'),
    function_name: 'adminResolveRefund',
  }),
  prepareAdminResolveReleaseCall: (dealId) => ({
    chain_id: 8453,
    contract_address: '0x0000000000000000000000000000000000000001',
    data: '0x' + String(dealId).padStart(64, '0'),
    function_name: 'adminResolveRelease',
  }),
  DealsRepositoryError,
  ConsultEscrowConfigError,
};

global.__dealsAdminMocks = mocks;

const root = path.resolve(__dirname, '../../');

const adminResolutionIntentsRepoPath = path.resolve(root, 'server/repositories/admin-resolution-intents.ts');
require.cache[adminResolutionIntentsRepoPath] = makeEntry(adminResolutionIntentsRepoPath, {
  AdminResolutionIntentsRepositoryError: class AdminResolutionIntentsRepositoryError extends Error {
    constructor(message, code) {
      super(message);
      this.name = 'AdminResolutionIntentsRepositoryError';
      this.code = code;
    }
  },
  createAdminResolutionIntent: (...args) => mocks.createAdminResolutionIntent(...args),
});

const complianceChecksRepoPath = path.resolve(root, 'server/repositories/compliance-checks.ts');
require.cache[complianceChecksRepoPath] = makeEntry(complianceChecksRepoPath, {
  ComplianceChecksRepositoryError: class ComplianceChecksRepositoryError extends Error {
    constructor(message, code) {
      super(message);
      this.name = 'ComplianceChecksRepositoryError';
      this.code = code;
    }
  },
  findByDealNewestFirst: (...args) => mocks.findByDealNewestFirst(...args),
});

const payoutExecutionGrantsRepoPath = path.resolve(root, 'server/repositories/payout-execution-grants.ts');
require.cache[payoutExecutionGrantsRepoPath] = makeEntry(payoutExecutionGrantsRepoPath, {
  PayoutExecutionGrantsRepositoryError: class PayoutExecutionGrantsRepositoryError extends Error {
    constructor(message, code) {
      super(message);
      this.name = 'PayoutExecutionGrantsRepositoryError';
      this.code = code;
    }
  },
  createPayoutExecutionGrant: (...args) => mocks.createPayoutExecutionGrant(...args),
  consumePayoutExecutionGrant: (...args) => mocks.consumePayoutExecutionGrant(...args),
});

const dealsRepoPath = path.resolve(root, 'server/repositories/deals.ts');
require.cache[dealsRepoPath] = makeEntry(dealsRepoPath, {
  DealsRepositoryError,
  getAdminDealReviewRowById: (...args) => mocks.getAdminDealReviewRowById(...args),
  getDealActionContextById: (...args) => mocks.getDealActionContextById(...args),
  listDisputedDealReviewRows: (...args) => mocks.listDisputedDealReviewRows(...args),
});

const complianceServicePath = path.resolve(root, 'server/services/compliance.ts');
require.cache[complianceServicePath] = makeEntry(complianceServicePath, {
  assertDealNotBlocked: (...args) => mocks.assertDealNotBlocked(...args),
  screenWalletForDeal: (...args) => mocks.screenWalletForDeal(...args),
});

class ComplianceBlockedError extends Error {
  constructor(input) {
    super(input.reasonCode);
    this.name = 'ComplianceBlockedError';
    this.dealId = input.dealId;
    this.provider = input.provider;
    this.reasonCode = input.reasonCode;
    this.walletAddress = input.walletAddress;
  }
}

const errorMappingPath = path.resolve(root, 'lib/compliance/error-mapping.ts');
require.cache[errorMappingPath] = makeEntry(errorMappingPath, {
  ComplianceBlockedError,
  assertCompliance: (...args) => mocks.assertCompliance(...args),
  withComplianceErrorHandling: (handler) => handler,
});

const escrowPath = path.resolve(root, 'lib/base/consult-escrow.ts');
require.cache[escrowPath] = makeEntry(escrowPath, {
  ConsultEscrowConfigError,
  prepareAdminResolveRefundCall: (...args) => mocks.prepareAdminResolveRefundCall(...args),
  prepareAdminResolveReleaseCall: (...args) => mocks.prepareAdminResolveReleaseCall(...args),
});
