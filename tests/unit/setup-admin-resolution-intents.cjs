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

const mocks = {
  calls: {
    rpc: [],
    schema: [],
  },
};

mocks.reset = () => {
  mocks.calls = {
    rpc: [],
    schema: [],
  };
  mocks.maybeSingleResult = {
    data: {
      id: 'intent-id-1',
      admin_wallet: '0x0000000000000000000000000000000000000009',
      consumed_at: '2026-04-30T12:00:00.000Z',
      created_at: '2026-04-30T11:00:00.000Z',
      deal_id: 'deal-id-1',
      onchain_deal_id: '42',
      resolution: 'release',
    },
    error: null,
  };
};

mocks.reset();
global.__adminResolutionIntentsRepoMocks = mocks;

const root = path.resolve(__dirname, '../../');
const dbServerPath = path.resolve(root, 'lib/db/server.ts');

function makeRpcBuilder() {
  return {
    returns() {
      return this;
    },
    async maybeSingle() {
      return mocks.maybeSingleResult;
    },
  };
}

function makeQueryBuilder() {
  return {
    schema(schemaName) {
      mocks.calls.schema.push(schemaName);
      return this;
    },
    rpc(functionName, params) {
      mocks.calls.rpc.push([functionName, params]);
      return makeRpcBuilder();
    },
  };
}

require.cache[dbServerPath] = makeEntry(dbServerPath, {
  getServerDbClient: () => makeQueryBuilder(),
});
