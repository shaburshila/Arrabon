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
  countRecentSecurityRequestAttempts: async () => 0,
  createAuditLogEntry: async () => ({}),
  createSecurityRequestAttempt: async () => ({
    id: 'attempt-id-1',
  }),
  deleteExpiredSecurityRequestAttempts: async () => {},
  parseDealRouteParams: (params) => ({
    dealId: params.id ?? 'deal-id-1',
  }),
  requireUser: async () => ({
    avatar_url: null,
    expires_at: '2026-04-28T00:00:00.000Z',
    id: 'user-id-1',
    is_admin: false,
    username: null,
    wallet_address: '0x00000000000000000000000000000000000000AA',
  }),
  revealMeetingUrlForDeal: async () => ({
    meeting_url: 'https://example.com/meeting',
  }),
};

global.__dealsMeetingUrlRouteMocks = mocks;

const root = path.resolve(__dirname, '../../');

require.cache[require.resolve('server-only')] = makeEntry('server-only', {});

class AuthGuardError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'AuthGuardError';
    this.status = status;
  }
}

global.__dealsMeetingUrlRouteAuthGuardError = AuthGuardError;

class DealValidationError extends Error {
  constructor(issues) {
    super('Invalid deal route params.');
    this.name = 'DealValidationError';
    this.issues = issues;
  }
}

class DealReadServiceError extends Error {
  constructor(message, status, code = 'DEAL_READ_FAILED') {
    super(message);
    this.name = 'DealReadServiceError';
    this.status = status;
    this.code = code;
  }
}

const authGuardsPath = path.resolve(root, 'lib/auth/guards.ts');
require.cache[authGuardsPath] = makeEntry(authGuardsPath, {
  AuthGuardError,
  requireUser: (...args) => mocks.requireUser(...args),
});

const dealValidatorsPath = path.resolve(root, 'lib/validators/deals.ts');
require.cache[dealValidatorsPath] = makeEntry(dealValidatorsPath, {
  DealValidationError,
  parseDealRouteParams: (...args) => mocks.parseDealRouteParams(...args),
});

const auditLogPath = path.resolve(root, 'server/repositories/audit-log.ts');
require.cache[auditLogPath] = makeEntry(auditLogPath, {
  createAuditLogEntry: (...args) => mocks.createAuditLogEntry(...args),
});

const securityRequestAttemptsRepoPath = path.resolve(root, 'server/repositories/security-request-attempts.ts');
require.cache[securityRequestAttemptsRepoPath] = makeEntry(securityRequestAttemptsRepoPath, {
  countRecentSecurityRequestAttempts: (...args) => mocks.countRecentSecurityRequestAttempts(...args),
  createSecurityRequestAttempt: (...args) => mocks.createSecurityRequestAttempt(...args),
  deleteExpiredSecurityRequestAttempts: (...args) => mocks.deleteExpiredSecurityRequestAttempts(...args),
});

const dealsReadServicePath = path.resolve(root, 'server/services/deals-read.ts');
require.cache[dealsReadServicePath] = makeEntry(dealsReadServicePath, {
  DealReadServiceError,
  revealMeetingUrlForDeal: (...args) => mocks.revealMeetingUrlForDeal(...args),
});
