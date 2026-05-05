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
    eq: [],
    gt: [],
    insert: [],
    is: [],
    schema: [],
    update: [],
  },
};

mocks.reset = () => {
  mocks.calls = {
    eq: [],
    gt: [],
    insert: [],
    is: [],
    schema: [],
    update: [],
  };
  mocks.singleResult = {
    data: {
      consultation_link_id: 'link-id-1',
      created_at: '2030-04-27T00:00:00.000Z',
      expires_at: '2030-04-27T00:05:00.000Z',
      id: 'grant-id-1',
      issued_by_wallet: '0x00000000000000000000000000000000000000AA',
      issued_to_wallet: '0x00000000000000000000000000000000000000AA',
      token_hash: 'hash-1',
      used_at: null,
    },
    error: null,
  };
  mocks.maybeSingleResult = {
    data: {
      consultation_link_id: 'link-id-1',
      created_at: '2030-04-27T00:00:00.000Z',
      expires_at: '2030-04-27T00:05:00.000Z',
      id: 'grant-id-1',
      issued_by_wallet: '0x00000000000000000000000000000000000000AA',
      issued_to_wallet: '0x00000000000000000000000000000000000000AA',
      token_hash: 'hash-1',
      used_at: '2030-04-27T00:03:00.000Z',
    },
    error: null,
  };
};

mocks.reset();
global.__fundingExecutionGrantsRepoMocks = mocks;

const root = path.resolve(__dirname, '../../');
const dbServerPath = path.resolve(root, 'lib/db/server.ts');

function makeSelectBuilder() {
  return {
    async maybeSingle() {
      return mocks.maybeSingleResult;
    },
    async single() {
      return mocks.singleResult;
    },
  };
}

function makeUpdateBuilder() {
  return {
    eq(field, value) {
      mocks.calls.eq.push([field, value]);
      return this;
    },
    gt(field, value) {
      mocks.calls.gt.push([field, value]);
      return this;
    },
    is(field, value) {
      mocks.calls.is.push([field, value]);
      return this;
    },
    select() {
      return makeSelectBuilder();
    },
  };
}

function makeFromBuilder() {
  return {
    insert(payload) {
      mocks.calls.insert.push(payload);
      return {
        select() {
          return makeSelectBuilder();
        },
      };
    },
    update(payload) {
      mocks.calls.update.push(payload);
      return makeUpdateBuilder();
    },
  };
}

function makeQueryBuilder() {
  return {
    from() {
      return makeFromBuilder();
    },
    schema(schemaName) {
      mocks.calls.schema.push(schemaName);
      return this;
    },
  };
}

require.cache[dbServerPath] = makeEntry(dbServerPath, {
  getServerDbClient: () => makeQueryBuilder(),
});
