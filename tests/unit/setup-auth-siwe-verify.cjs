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
  createAuthSession: async () => ({
    expiresAt: new Date('2026-05-01T12:00:00.000Z'),
    session: {
      id: 'session-id-1',
      is_admin: false,
    },
    token: 'session-token',
  }),
  createSecurityRequestAttempt: async () => ({
    id: 'attempt-id-1',
  }),
  consumeValidNonce: async () => ({
    id: 'nonce-id-1',
  }),
  deleteExpiredSecurityRequestAttempts: async () => {},
  getOrCreateUser: async () => ({
    id: 'user-id-1',
    wallet: '0x0000000000000000000000000000000000000001',
  }),
  parseSiweMessage: () => ({
    address: '0x0000000000000000000000000000000000000001',
  }),
  resolveAllowedAuthDomains: () => ['localhost'],
  setSessionCookie: () => {},
  verifySiweMessage: async () => ({
    address: '0x0000000000000000000000000000000000000001',
    nonce: 'nonce-1',
  }),
};

global.__authSiweVerifyMocks = mocks;

const root = path.resolve(__dirname, '../../');

require.cache[require.resolve('server-only')] = makeEntry('server-only', {});

const authConfigPath = path.resolve(root, 'lib/auth/config.ts');
require.cache[authConfigPath] = makeEntry(authConfigPath, {
  resolveAllowedAuthDomains: (...args) => mocks.resolveAllowedAuthDomains(...args),
});

const authCookiesPath = path.resolve(root, 'lib/auth/cookies.ts');
require.cache[authCookiesPath] = makeEntry(authCookiesPath, {
  setSessionCookie: (...args) => mocks.setSessionCookie(...args),
});

const authSessionPath = path.resolve(root, 'lib/auth/session.ts');
require.cache[authSessionPath] = makeEntry(authSessionPath, {
  createAuthSession: (...args) => mocks.createAuthSession(...args),
});

const authSiwePath = path.resolve(root, 'lib/auth/siwe.ts');
require.cache[authSiwePath] = makeEntry(authSiwePath, {
  AUTH_VERIFY_RATE_LIMIT_MAX_REQUESTS: 5,
  AUTH_VERIFY_RATE_LIMIT_WINDOW_MS: 10 * 60 * 1000,
  parseSiweMessage: (...args) => mocks.parseSiweMessage(...args),
  verifySiweMessage: (...args) => mocks.verifySiweMessage(...args),
});

const noncesRepoPath = path.resolve(root, 'server/repositories/nonces.ts');
require.cache[noncesRepoPath] = makeEntry(noncesRepoPath, {
  consumeValidNonce: (...args) => mocks.consumeValidNonce(...args),
});

const usersRepoPath = path.resolve(root, 'server/repositories/users.ts');
require.cache[usersRepoPath] = makeEntry(usersRepoPath, {
  getOrCreateUser: (...args) => mocks.getOrCreateUser(...args),
});

const securityRequestAttemptsRepoPath = path.resolve(root, 'server/repositories/security-request-attempts.ts');
require.cache[securityRequestAttemptsRepoPath] = makeEntry(securityRequestAttemptsRepoPath, {
  countRecentSecurityRequestAttempts: (...args) => mocks.countRecentSecurityRequestAttempts(...args),
  createSecurityRequestAttempt: (...args) => mocks.createSecurityRequestAttempt(...args),
  deleteExpiredSecurityRequestAttempts: (...args) => mocks.deleteExpiredSecurityRequestAttempts(...args),
});
