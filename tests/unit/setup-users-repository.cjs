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
  singleResult: {
    data: {
      avatar_url: null,
      created_at: '2026-04-10T00:00:00.000Z',
      id: 'user-id-1',
      username: null,
      wallet: '0x0000000000000000000000000000000000000001',
    },
    error: null,
  },
  calls: {
    from: [],
    schema: [],
    select: [],
    single: 0,
    upsert: [],
  },
};

mocks.reset = () => {
  mocks.singleResult = {
    data: {
      avatar_url: null,
      created_at: '2026-04-10T00:00:00.000Z',
      id: 'user-id-1',
      username: null,
      wallet: '0x0000000000000000000000000000000000000001',
    },
    error: null,
  };
  mocks.calls = {
    from: [],
    schema: [],
    select: [],
    single: 0,
    upsert: [],
  };
};

global.__usersRepositoryMocks = mocks;

const root = path.resolve(__dirname, '../../');
const dbServerPath = path.resolve(root, 'lib/db/server.ts');

function makeQueryBuilder() {
  return {
    from(table) {
      mocks.calls.from.push(table);
      return this;
    },
    schema(schemaName) {
      mocks.calls.schema.push(schemaName);
      return this;
    },
    upsert(payload, options) {
      mocks.calls.upsert.push([payload, options]);
      return this;
    },
    select(columns) {
      mocks.calls.select.push(columns);
      return this;
    },
    async single() {
      mocks.calls.single += 1;
      return mocks.singleResult;
    },
  };
}

require.cache[dbServerPath] = makeEntry(dbServerPath, {
  getServerDbClient: () => makeQueryBuilder(),
});
