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

const mocks = {
  classifyDealEventsWorkerError: () => ({
    code: 'DEAL_EVENTS_WORKER_FAILED',
    type: 'fatal',
  }),
  getDealByTxHash: async () => ({
    consultation_link_id: '11111111-1111-4111-8111-111111111111',
  }),
  parsePrepareFundingParams: (params) => ({
    linkId: params.id ?? '11111111-1111-4111-8111-111111111111',
  }),
  requireUser: async () => ({
    avatar_url: null,
    expires_at: '2026-04-28T00:00:00.000Z',
    id: 'user-id-1',
    is_admin: false,
    username: null,
    wallet_address: '0x00000000000000000000000000000000000000AA',
  }),
  runDealEventsWorker: async () => ({
    alreadyProcessed: 0,
    fromBlock: 0n,
    processed: 0,
    skipped: 0,
    toBlock: 0n,
  }),
  runDealEventsWorkerForTx: async () => ({
    status: 'processed',
    summary: {
      alreadyProcessed: 0,
      fromBlock: 0n,
      processed: 1,
      skipped: 0,
      toBlock: 0n,
    },
  }),
  serializeDealEventsWorkerRunSummary: (summary) => ({
    alreadyProcessed: summary.alreadyProcessed,
    fromBlock: summary.fromBlock.toString(),
    processed: summary.processed,
    skipped: summary.skipped,
    toBlock: summary.toBlock.toString(),
  }),
};

global.__fundingSyncRouteMocks = mocks;

const root = path.resolve(__dirname, '../../');

require.cache[require.resolve('server-only')] = makeEntry('server-only', {});

class AuthGuardError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'AuthGuardError';
    this.status = status;
  }
}

class FundingValidationError extends Error {
  constructor(issues) {
    super('Invalid funding preparation input.');
    this.name = 'FundingValidationError';
    this.issues = issues;
  }
}

class DealsRepositoryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'DealsRepositoryError';
    this.code = code;
  }
}

const authGuardsPath = path.resolve(root, 'lib/auth/guards.ts');
require.cache[authGuardsPath] = makeEntry(authGuardsPath, {
  AuthGuardError,
  requireUser: (...args) => mocks.requireUser(...args),
});

const fundingValidatorsPath = path.resolve(root, 'lib/validators/funding.ts');
require.cache[fundingValidatorsPath] = makeEntry(fundingValidatorsPath, {
  FundingValidationError,
  parsePrepareFundingParams: (...args) => mocks.parsePrepareFundingParams(...args),
});

const dealEventsWorkerErrorClassificationPath = path.resolve(root, 'server/workers/deal-events-error-classification.ts');
require.cache[dealEventsWorkerErrorClassificationPath] = makeEntry(
  dealEventsWorkerErrorClassificationPath,
  {
    classifyDealEventsWorkerError: (...args) => mocks.classifyDealEventsWorkerError(...args),
  },
);

const dealsRepoPath = path.resolve(root, 'server/repositories/deals.ts');
require.cache[dealsRepoPath] = makeEntry(dealsRepoPath, {
  DealsRepositoryError,
  getDealByTxHash: (...args) => mocks.getDealByTxHash(...args),
});

const dealEventsWorkerPath = path.resolve(root, 'server/workers/deal-events.ts');
require.cache[dealEventsWorkerPath] = makeEntry(dealEventsWorkerPath, {
  runDealEventsWorker: (...args) => mocks.runDealEventsWorker(...args),
  runDealEventsWorkerForTx: (...args) => mocks.runDealEventsWorkerForTx(...args),
  serializeDealEventsWorkerRunSummary: (...args) => mocks.serializeDealEventsWorkerRunSummary(...args),
});
