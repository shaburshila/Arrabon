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
  assertCompliance: () => {},
  createAdminResolutionIntent: async () => ({ id: 'intent-id-1' }),
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
    args: { deal_id: dealId },
    chain_id: 8453,
    contract_address: '0x0000000000000000000000000000000000000001',
    function_name: 'adminResolveRefund',
  }),
  prepareAdminResolveReleaseCall: (dealId) => ({
    args: { deal_id: dealId },
    chain_id: 8453,
    contract_address: '0x0000000000000000000000000000000000000001',
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

const dealsRepoPath = path.resolve(root, 'server/repositories/deals.ts');
require.cache[dealsRepoPath] = makeEntry(dealsRepoPath, {
  DealsRepositoryError,
  getAdminDealReviewRowById: (...args) => mocks.getAdminDealReviewRowById(...args),
  getDealActionContextById: (...args) => mocks.getDealActionContextById(...args),
  listDisputedDealReviewRows: (...args) => mocks.listDisputedDealReviewRows(...args),
});

const complianceServicePath = path.resolve(root, 'server/services/compliance.ts');
require.cache[complianceServicePath] = makeEntry(complianceServicePath, {
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
