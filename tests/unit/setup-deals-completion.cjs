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
  getDealActionContextById: async () => null,
  prepareConfirmReleaseCall: (dealId) => ({
    args: { deal_id: dealId },
    chain_id: 8453,
    contract_address: '0x0000000000000000000000000000000000000001',
    function_name: 'confirmRelease',
  }),
  prepareMarkCompletedCall: (dealId) => ({
    args: { deal_id: dealId },
    chain_id: 8453,
    contract_address: '0x0000000000000000000000000000000000000001',
    function_name: 'markCompleted',
  }),
  prepareOpenDisputeCall: (dealId) => ({
    args: { deal_id: dealId },
    chain_id: 8453,
    contract_address: '0x0000000000000000000000000000000000000001',
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

const escrowPath = path.resolve(root, 'lib/base/consult-escrow.ts');
require.cache[escrowPath] = makeEntry(escrowPath, {
  ConsultEscrowConfigError,
  prepareConfirmReleaseCall: (...args) => mocks.prepareConfirmReleaseCall(...args),
  prepareMarkCompletedCall: (...args) => mocks.prepareMarkCompletedCall(...args),
  prepareOpenDisputeCall: (...args) => mocks.prepareOpenDisputeCall(...args),
});
