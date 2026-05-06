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
  applyDealPayoutBlock: async () => '0x' + 'f'.repeat(64),
  createAuditLogEntry: async () => undefined,
  getDealActionContextById: async () => ({
    buyer_address: '0x0000000000000000000000000000000000000002',
    completed_at: null,
    consultation_link_id: 'link-id-1',
    id: 'deal-id-1',
    onchain_deal_id: '11',
    released_at: null,
    risk_status: 'Blocked',
    scheduled_at: '2030-01-02T00:00:00.000Z',
    seller_address: '0x0000000000000000000000000000000000000001',
    status: 'Funded',
  }),
  getByLinkHash: async () => null,
  getByTxHash: async () => null,
  isInvalidStateTransitionHoldError: () => false,
  listPendingDenylistDealPayoutBlockRequests: async () => [],
  listPendingFundingHoldProcessedTransactions: async () => [],
  markDealPayoutBlockRequestApplied: async () => undefined,
  markDealPayoutBlockRequestFailure: async () => undefined,
  markDealPayoutBlockRequestNonActionable: async () => undefined,
  processConfirmedCompletedEventOnce: async () => ({ alreadyProcessed: false, dealId: 'deal-id-completed' }),
  processConfirmedDisputedEventOnce: async () => ({ alreadyProcessed: false, dealId: 'deal-id-disputed' }),
  processConfirmedFundedEventOnce: async () => ({ alreadyProcessed: false, dealId: 'deal-id-1', holdApplied: null }),
  processConfirmedRefundedEventOnce: async () => ({ alreadyProcessed: false, dealId: 'deal-id-refunded' }),
  processConfirmedReleasedEventOnce: async () => ({ alreadyProcessed: false, dealId: 'deal-id-released' }),
  screenWalletsBatch: async () => [],
  updateProcessedTransactionHoldApplied: async () => undefined,
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

const dealPayoutBlockRequestsRepoPath = path.resolve(root, 'server/repositories/deal-payout-block-requests.ts');
require.cache[dealPayoutBlockRequestsRepoPath] = makeEntry(dealPayoutBlockRequestsRepoPath, {
  listPendingDenylistDealPayoutBlockRequests: (...args) => mocks.listPendingDenylistDealPayoutBlockRequests(...args),
  markDealPayoutBlockRequestApplied: (...args) => mocks.markDealPayoutBlockRequestApplied(...args),
  markDealPayoutBlockRequestFailure: (...args) => mocks.markDealPayoutBlockRequestFailure(...args),
  markDealPayoutBlockRequestNonActionable: (...args) => mocks.markDealPayoutBlockRequestNonActionable(...args),
});

const processedTransactionsRepoPath = path.resolve(root, 'server/repositories/processed-transactions.ts');
require.cache[processedTransactionsRepoPath] = makeEntry(processedTransactionsRepoPath, {
  ProcessedTransactionsRepositoryError,
  getByTxHash: (...args) => mocks.getByTxHash(...args),
  listPendingFundingHoldProcessedTransactions: (...args) => mocks.listPendingFundingHoldProcessedTransactions(...args),
  processConfirmedCompletedEventOnce: (...args) => mocks.processConfirmedCompletedEventOnce(...args),
  processConfirmedDisputedEventOnce: (...args) => mocks.processConfirmedDisputedEventOnce(...args),
  processConfirmedFundedEventOnce: (...args) => mocks.processConfirmedFundedEventOnce(...args),
  processConfirmedRefundedEventOnce: (...args) => mocks.processConfirmedRefundedEventOnce(...args),
  processConfirmedReleasedEventOnce: (...args) => mocks.processConfirmedReleasedEventOnce(...args),
  updateProcessedTransactionHoldApplied: (...args) => mocks.updateProcessedTransactionHoldApplied(...args),
});

const dealsRepoPath = path.resolve(root, 'server/repositories/deals.ts');
require.cache[dealsRepoPath] = makeEntry(dealsRepoPath, {
  DealsRepositoryError: class DealsRepositoryError extends Error {
    constructor(message, code) {
      super(message);
      this.name = 'DealsRepositoryError';
      this.code = code;
    }
  },
  getDealActionContextById: (...args) => mocks.getDealActionContextById(...args),
});

const complianceServicePath = path.resolve(root, 'server/services/compliance.ts');
require.cache[complianceServicePath] = makeEntry(complianceServicePath, {
  screenWalletsBatch: (...args) => mocks.screenWalletsBatch(...args),
});

const complianceHoldPath = path.resolve(root, 'lib/base/compliance-hold.ts');
require.cache[complianceHoldPath] = makeEntry(complianceHoldPath, {
  applyDealPayoutBlock: (...args) => mocks.applyDealPayoutBlock(...args),
  isInvalidStateTransitionHoldError: (...args) => mocks.isInvalidStateTransitionHoldError(...args),
});
