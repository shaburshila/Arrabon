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

const mocks = {
  advanceDealEventsSyncCursor: async () => 0n,
  client: {
    getBlockNumber: async () => 0n,
    getLogs: async () => [],
    getTransactionReceipt: async () => ({
      blockNumber: 0n,
      logs: [],
    }),
  },
  getByTxHash: async () => null,
  getConsultEscrowContractAddress: () => '0x0000000000000000000000000000000000000001',
  getConsultEscrowEventDefinitions: () => ({
    completed: 'completed',
    disputed: 'disputed',
    funded: 'funded',
    refunded: 'refunded',
    released: 'released',
  }),
  initializeDealEventsSyncCursorIfMissing: async () => -1n,
  parseCompletedEventLog: async () => ({ type: 'Completed' }),
  parseDisputedEventLog: async () => ({ type: 'Disputed' }),
  parseFundedEventLog: async () => ({ type: 'Funded' }),
  parseRefundedEventLog: async () => ({ type: 'Refunded' }),
  parseReleasedEventLog: async () => ({ type: 'Released' }),
  processConfirmedDealEvent: async () => ({ result: 'processed' }),
  processPendingDenylistHoldSweeps: async () => undefined,
  processPendingDealRiskRecomputeSweeps: async () => undefined,
  processPendingFundingHoldForProcessedTransaction: async () => undefined,
  processPendingFundingHoldSweeps: async () => undefined,
};

global.__dealEventsWorkerMocks = mocks;

const root = path.resolve(__dirname, '../../');

const viemPath = require.resolve('viem');
require.cache[viemPath] = makeEntry(viemPath, {
  createPublicClient: () => ({
    getBlockNumber: (...args) => mocks.client.getBlockNumber(...args),
    getLogs: (...args) => mocks.client.getLogs(...args),
    getTransactionReceipt: (...args) => mocks.client.getTransactionReceipt(...args),
  }),
  getAddress: (value) => value,
  http: () => ({}),
  toEventSelector: (value) => value,
});

const consultEscrowPath = path.resolve(root, 'lib/base/consult-escrow.ts');
require.cache[consultEscrowPath] = makeEntry(consultEscrowPath, {
  getConsultEscrowContractAddress: (...args) => mocks.getConsultEscrowContractAddress(...args),
  getConsultEscrowEventDefinitions: (...args) => mocks.getConsultEscrowEventDefinitions(...args),
  parseCompletedEventLog: (...args) => mocks.parseCompletedEventLog(...args),
  parseDisputedEventLog: (...args) => mocks.parseDisputedEventLog(...args),
  parseFundedEventLog: (...args) => mocks.parseFundedEventLog(...args),
  parseRefundedEventLog: (...args) => mocks.parseRefundedEventLog(...args),
  parseReleasedEventLog: (...args) => mocks.parseReleasedEventLog(...args),
});

const baseConfigPath = path.resolve(root, 'lib/base/config.ts');
require.cache[baseConfigPath] = makeEntry(baseConfigPath, {
  baseRuntimeConfig: {
    chain: { id: 8453 },
    rpcUrl: 'http://localhost:8545',
  },
});

const dealEventsServicePath = path.resolve(root, 'server/services/deal-events.ts');
require.cache[dealEventsServicePath] = makeEntry(dealEventsServicePath, {
  processConfirmedDealEvent: (...args) => mocks.processConfirmedDealEvent(...args),
  processPendingDenylistHoldSweeps: (...args) => mocks.processPendingDenylistHoldSweeps(...args),
  processPendingFundingHoldForProcessedTransaction: (...args) =>
    mocks.processPendingFundingHoldForProcessedTransaction(...args),
  processPendingFundingHoldSweeps: (...args) => mocks.processPendingFundingHoldSweeps(...args),
});

const complianceServicePath = path.resolve(root, 'server/services/compliance.ts');
require.cache[complianceServicePath] = makeEntry(complianceServicePath, {
  processPendingDealRiskRecomputeSweeps: (...args) =>
    mocks.processPendingDealRiskRecomputeSweeps(...args),
});

const processedTransactionsRepoPath = path.resolve(root, 'server/repositories/processed-transactions.ts');
require.cache[processedTransactionsRepoPath] = makeEntry(processedTransactionsRepoPath, {
  getByTxHash: (...args) => mocks.getByTxHash(...args),
});

const cursorRepoPath = path.resolve(root, 'server/repositories/deal-event-sync-cursors.ts');
require.cache[cursorRepoPath] = makeEntry(cursorRepoPath, {
  advanceDealEventsSyncCursor: (...args) => mocks.advanceDealEventsSyncCursor(...args),
  initializeDealEventsSyncCursorIfMissing: (...args) =>
    mocks.initializeDealEventsSyncCursorIfMissing(...args),
});
