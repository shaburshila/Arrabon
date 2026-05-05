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
  processConfirmedCompletedEventOnce: async () => ({ alreadyProcessed: false, dealId: 'deal-id-completed' }),
  processConfirmedDisputedEventOnce: async () => ({ alreadyProcessed: false, dealId: 'deal-id-disputed' }),
  processConfirmedFundedEventOnce: async () => ({ alreadyProcessed: false, dealId: 'deal-id-1' }),
  processConfirmedRefundedEventOnce: async () => ({ alreadyProcessed: false, dealId: 'deal-id-refunded' }),
  processConfirmedReleasedEventOnce: async () => ({ alreadyProcessed: false, dealId: 'deal-id-released' }),
  screenWalletsBatch: async () => [],
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

const processedTransactionsRepoPath = path.resolve(root, 'server/repositories/processed-transactions.ts');
require.cache[processedTransactionsRepoPath] = makeEntry(processedTransactionsRepoPath, {
  ProcessedTransactionsRepositoryError,
  getByTxHash: (...args) => mocks.getByTxHash(...args),
  processConfirmedCompletedEventOnce: (...args) => mocks.processConfirmedCompletedEventOnce(...args),
  processConfirmedDisputedEventOnce: (...args) => mocks.processConfirmedDisputedEventOnce(...args),
  processConfirmedFundedEventOnce: (...args) => mocks.processConfirmedFundedEventOnce(...args),
  processConfirmedRefundedEventOnce: (...args) => mocks.processConfirmedRefundedEventOnce(...args),
  processConfirmedReleasedEventOnce: (...args) => mocks.processConfirmedReleasedEventOnce(...args),
});

const complianceServicePath = path.resolve(root, 'server/services/compliance.ts');
require.cache[complianceServicePath] = makeEntry(complianceServicePath, {
  screenWalletsBatch: (...args) => mocks.screenWalletsBatch(...args),
});
