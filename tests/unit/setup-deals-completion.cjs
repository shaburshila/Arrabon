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
  createPayoutExecutionGrant: async () => ({
    id: 'grant-id-1',
  }),
  consumePayoutExecutionGrant: async () => ({
    action: 'confirmRelease',
    created_at: '2026-05-05T00:00:00.000Z',
    deal_id: 'deal-id-1',
    expires_at: '2026-05-05T00:02:00.000Z',
    id: 'grant-id-1',
    issued_by_wallet: '0x0000000000000000000000000000000000000002',
    issued_to_wallet: '0x0000000000000000000000000000000000000002',
    resolution: null,
    token_hash: 'token-hash',
    used_at: '2026-05-05T00:01:00.000Z',
  }),
  getDealActionContextById: async () => null,
  screenWalletForDeal: async () => ({
    normalizedWallet: '0x0000000000000000000000000000000000000001',
    provider: 'local_denylist',
    rawSummary: {},
    reasonCode: 'NO_HIT',
    result: 'Clear',
    walletAddress: '0x0000000000000000000000000000000000000001',
  }),
  prepareConfirmReleaseCall: (dealId) => ({
    chain_id: 8453,
    contract_address: '0x0000000000000000000000000000000000000001',
    data: '0x' + String(dealId).padStart(64, '0'),
    function_name: 'confirmRelease',
  }),
  prepareAutoReleaseCall: (dealId) => ({
    chain_id: 8453,
    contract_address: '0x0000000000000000000000000000000000000001',
    data: '0x' + String(dealId).padStart(64, '0'),
    function_name: 'autoRelease',
  }),
  prepareMarkCompletedCall: (dealId) => ({
    chain_id: 8453,
    contract_address: '0x0000000000000000000000000000000000000001',
    data: '0x' + String(dealId).padStart(64, '0'),
    function_name: 'markCompleted',
  }),
  prepareOpenDisputeCall: (dealId) => ({
    chain_id: 8453,
    contract_address: '0x0000000000000000000000000000000000000001',
    data: '0x' + String(dealId).padStart(64, '0'),
    function_name: 'openDispute',
  }),
  DealsRepositoryError,
  ConsultEscrowConfigError,
};

global.__dealsCompletionMocks = mocks;

const root = path.resolve(__dirname, '../../');

const dealsRepoPath = path.resolve(root, 'server/repositories/deals.ts');
require.cache[dealsRepoPath] = makeEntry(dealsRepoPath, {
  DealsRepositoryError,
  getDealActionContextById: (...args) => mocks.getDealActionContextById(...args),
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
  prepareAutoReleaseCall: (...args) => mocks.prepareAutoReleaseCall(...args),
  prepareConfirmReleaseCall: (...args) => mocks.prepareConfirmReleaseCall(...args),
  prepareMarkCompletedCall: (...args) => mocks.prepareMarkCompletedCall(...args),
  prepareOpenDisputeCall: (...args) => mocks.prepareOpenDisputeCall(...args),
});
