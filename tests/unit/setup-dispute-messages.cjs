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

class DisputeMessagesRepositoryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'DisputeMessagesRepositoryError';
    this.code = code;
  }
}

const mocks = {
  createAuditLogEntry: async () => ({}),
  createMessage: async (input) => ({
    author_role: input.authorRole,
    author_wallet: input.authorWallet,
    body: input.body,
    created_at: '2026-04-17T10:00:00.000Z',
    deal_id: input.dealId,
    evidence_url: input.evidenceUrl,
    id: 'message-id-1',
  }),
  getDealActionContextById: async () => null,
  listByDealId: async () => [],
  DealsRepositoryError,
  DisputeMessagesRepositoryError,
};

global.__disputeMessagesMocks = mocks;

const root = path.resolve(__dirname, '../../');

const dealsRepoPath = path.resolve(root, 'server/repositories/deals.ts');
require.cache[dealsRepoPath] = makeEntry(dealsRepoPath, {
  DealsRepositoryError,
  getDealActionContextById: (...args) => mocks.getDealActionContextById(...args),
});

const disputeMessagesRepoPath = path.resolve(root, 'server/repositories/dispute-messages.ts');
require.cache[disputeMessagesRepoPath] = makeEntry(disputeMessagesRepoPath, {
  DisputeMessagesRepositoryError,
  createMessage: (...args) => mocks.createMessage(...args),
  listByDealId: (...args) => mocks.listByDealId(...args),
});

const auditLogPath = path.resolve(root, 'server/repositories/audit-log.ts');
require.cache[auditLogPath] = makeEntry(auditLogPath, {
  createAuditLogEntry: (...args) => mocks.createAuditLogEntry(...args),
});
