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
  createAuthSession: async () => ({
    expiresAt: new Date('2026-05-01T12:00:00.000Z'),
    token: 'session-token',
  }),
  getOrCreateUser: async () => ({
    id: 'user-id-1',
    wallet: '0x0000000000000000000000000000000000000001',
  }),
  getValidNonce: async () => ({
    id: 'nonce-id-1',
  }),
  isAdminWallet: () => false,
  markUsed: async () => ({
    id: 'nonce-id-1',
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
  isAdminWallet: (...args) => mocks.isAdminWallet(...args),
});

const authSiwePath = path.resolve(root, 'lib/auth/siwe.ts');
require.cache[authSiwePath] = makeEntry(authSiwePath, {
  verifySiweMessage: (...args) => mocks.verifySiweMessage(...args),
});

const noncesRepoPath = path.resolve(root, 'server/repositories/nonces.ts');
require.cache[noncesRepoPath] = makeEntry(noncesRepoPath, {
  getValidNonce: (...args) => mocks.getValidNonce(...args),
  markUsed: (...args) => mocks.markUsed(...args),
});

const usersRepoPath = path.resolve(root, 'server/repositories/users.ts');
require.cache[usersRepoPath] = makeEntry(usersRepoPath, {
  getOrCreateUser: (...args) => mocks.getOrCreateUser(...args),
});
