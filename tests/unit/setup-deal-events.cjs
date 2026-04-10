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

class ProcessedTransactionsRepositoryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ProcessedTransactionsRepositoryError';
    this.code = code;
  }
}

const mocks = {
  createAuditLogEntry: async () => undefined,
  getByLinkHash: async () => null,
  getByTxHash: async () => null,
  handleFundedEvent: async () => ({ id: 'deal-id-1' }),
  insertProcessedTransaction: async () => ({ duplicate: false, row: { tx_hash: '0xtx' } }),
  setConfirmPendingByOnchainDealId: async () => ({ id: 'deal-id-1' }),
  setDisputedByOnchainDealId: async () => ({ id: 'deal-id-1' }),
  setRefundedByOnchainDealId: async () => ({ id: 'deal-id-1' }),
  setReleasedByOnchainDealId: async () => ({ id: 'deal-id-1' }),
  ProcessedTransactionsRepositoryError,
};

global.__dealEventMocks = mocks;

const root = path.resolve(__dirname, '../../');

const auditLogPath = path.resolve(root, 'server/repositories/audit-log.ts');
require.cache[auditLogPath] = makeEntry(auditLogPath, {
  createAuditLogEntry: (...args) => mocks.createAuditLogEntry(...args),
});

const consultationLinksRepoPath = path.resolve(root, 'server/repositories/consultation-links.ts');
require.cache[consultationLinksRepoPath] = makeEntry(consultationLinksRepoPath, {
  getByLinkHash: (...args) => mocks.getByLinkHash(...args),
});

const dealsRepoPath = path.resolve(root, 'server/repositories/deals.ts');
require.cache[dealsRepoPath] = makeEntry(dealsRepoPath, {
  setConfirmPendingByOnchainDealId: (...args) => mocks.setConfirmPendingByOnchainDealId(...args),
  setDisputedByOnchainDealId: (...args) => mocks.setDisputedByOnchainDealId(...args),
  setRefundedByOnchainDealId: (...args) => mocks.setRefundedByOnchainDealId(...args),
  setReleasedByOnchainDealId: (...args) => mocks.setReleasedByOnchainDealId(...args),
});

const processedTransactionsRepoPath = path.resolve(root, 'server/repositories/processed-transactions.ts');
require.cache[processedTransactionsRepoPath] = makeEntry(processedTransactionsRepoPath, {
  ProcessedTransactionsRepositoryError,
  getByTxHash: (...args) => mocks.getByTxHash(...args),
  insertProcessedTransaction: (...args) => mocks.insertProcessedTransaction(...args),
});

const dealsServicePath = path.resolve(root, 'server/services/deals.ts');
require.cache[dealsServicePath] = makeEntry(dealsServicePath, {
  handleFundedEvent: (...args) => mocks.handleFundedEvent(...args),
});
