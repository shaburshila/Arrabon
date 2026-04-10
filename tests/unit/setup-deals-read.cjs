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

const mocks = {
  createAuditLogEntry: async () => undefined,
  decryptMeetingUrl: () => 'https://meet.example/room',
  getDealReadViewById: async () => null,
  getDealRevealContextById: async () => null,
  DealsRepositoryError,
};

global.__dealsReadMocks = mocks;

const root = path.resolve(__dirname, '../../');

const auditLogPath = path.resolve(root, 'server/repositories/audit-log.ts');
require.cache[auditLogPath] = makeEntry(auditLogPath, {
  createAuditLogEntry: (...args) => mocks.createAuditLogEntry(...args),
});

const dealsRepoPath = path.resolve(root, 'server/repositories/deals.ts');
require.cache[dealsRepoPath] = makeEntry(dealsRepoPath, {
  DealsRepositoryError,
  getDealReadViewById: (...args) => mocks.getDealReadViewById(...args),
  getDealRevealContextById: (...args) => mocks.getDealRevealContextById(...args),
});

const meetingUrlPath = path.resolve(root, 'lib/crypto/meeting-url.ts');
require.cache[meetingUrlPath] = makeEntry(meetingUrlPath, {
  decryptMeetingUrl: (...args) => mocks.decryptMeetingUrl(...args),
});
