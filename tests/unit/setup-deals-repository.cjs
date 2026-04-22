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

class ConsultationLinksRepositoryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ConsultationLinksRepositoryError';
    this.code = code;
  }
}

const mocks = {
  calls: {
    dbFrom: [],
    eq: [],
    getById: [],
    getByIds: [],
    order: [],
    schema: [],
    select: [],
  },
  dealsResult: {
    data: [],
    error: null,
  },
  getById: async () => null,
  getByIds: async () => [],
};

mocks.reset = () => {
  mocks.calls = {
    dbFrom: [],
    eq: [],
    getById: [],
    getByIds: [],
    order: [],
    schema: [],
    select: [],
  };
  mocks.dealsResult = {
    data: [],
    error: null,
  };
  mocks.getById = async (...args) => {
    mocks.calls.getById.push(args);
    return null;
  };
  mocks.getByIds = async (...args) => {
    mocks.calls.getByIds.push(args);
    return [];
  };
};

mocks.reset();
global.__dealsRepositoryMocks = mocks;

const root = path.resolve(__dirname, '../../');
const dbServerPath = path.resolve(root, 'lib/db/server.ts');

function makeQueryBuilder() {
  return {
    schema(schemaName) {
      mocks.calls.schema.push(schemaName);
      return this;
    },
    from(table) {
      mocks.calls.dbFrom.push(table);
      return this;
    },
    select(columns) {
      mocks.calls.select.push(columns);
      return this;
    },
    eq(column, value) {
      mocks.calls.eq.push([column, value]);
      return this;
    },
    async order(column, options) {
      mocks.calls.order.push([column, options]);
      return mocks.dealsResult;
    },
  };
}

require.cache[dbServerPath] = makeEntry(dbServerPath, {
  getServerDbClient: () => makeQueryBuilder(),
});

const consultationLinksRepoPath = path.resolve(root, 'server/repositories/consultation-links.ts');
require.cache[consultationLinksRepoPath] = makeEntry(consultationLinksRepoPath, {
  ConsultationLinksRepositoryError,
  getById: (...args) => mocks.getById(...args),
  getByIds: (...args) => mocks.getByIds(...args),
});
