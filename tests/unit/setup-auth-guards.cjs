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
  readSessionCookie: async () => 'session-token',
  getAuthSessionFromToken: async () => ({
    expires_at: '2026-04-12T12:00:00.000Z',
    is_admin: false,
    session_id: 'session-id-1',
    wallet_address: '0x0000000000000000000000000000000000000001',
  }),
  getByWallet: async () => ({
    avatar_url: null,
    created_at: '2026-04-10T00:00:00.000Z',
    id: 'user-id-1',
    username: null,
    wallet: '0x0000000000000000000000000000000000000001',
  }),
};

global.__authGuardMocks = mocks;

const root = path.resolve(__dirname, '../../');

const cookiesPath = path.resolve(root, 'lib/auth/cookies.ts');
require.cache[cookiesPath] = makeEntry(cookiesPath, {
  readSessionCookie: (...args) => mocks.readSessionCookie(...args),
});

const sessionPath = path.resolve(root, 'lib/auth/session.ts');
require.cache[sessionPath] = makeEntry(sessionPath, {
  getAuthSessionFromToken: (...args) => mocks.getAuthSessionFromToken(...args),
});

const usersRepoPath = path.resolve(root, 'server/repositories/users.ts');
require.cache[usersRepoPath] = makeEntry(usersRepoPath, {
  getByWallet: (...args) => mocks.getByWallet(...args),
});
